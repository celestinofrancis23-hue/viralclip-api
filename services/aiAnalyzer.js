const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─────────────────────────────────────────────────────────────────────────────
//  Filtro de segmentos de música/louvor
//  Remove segmentos que parecem letras de música antes de enviar ao GPT.
// ─────────────────────────────────────────────────────────────────────────────

const WORSHIP_KEYWORDS = [
  "hallelujah", "halleluiah", "alleluia", "aleluia",
  "hosanna", "sanctus",
  "oh oh oh", "yeah yeah yeah", "la la la", "na na na",
  "hey hey hey",
];

// Palavras isoladas de louvor (só bloqueiam se forem a maioria do segmento)
const WORSHIP_SINGLE_WORDS = new Set([
  "hallelujah", "halleluiah", "alleluia", "aleluia", "hosanna",
]);

function looksLikeMusic(text) {
  const lower = text.toLowerCase().trim();
  const words  = lower.split(/\s+/).filter(Boolean);

  // Segmento muito curto (< 3 palavras)
  if (words.length < 3) return true;

  // Contém frases típicas de louvor musical
  for (const kw of WORSHIP_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }

  // Maioria das palavras são words de louvor isoladas
  const worshipWordCount = words.filter(w => WORSHIP_SINGLE_WORDS.has(w)).length;
  if (worshipWordCount >= Math.ceil(words.length / 2)) return true;

  return false;
}

function filterMusicSegments(segments) {
  const result   = [];
  let   removed  = 0;

  for (let i = 0; i < segments.length; i++) {
    const text = (segments[i].text || "").trim();

    // 1. Parece música pelo conteúdo?
    if (looksLikeMusic(text)) {
      console.log(`🎵 [Filter] Removido (conteúdo): "${text.slice(0, 70)}"`);
      removed++;
      continue;
    }

    // 2. Mesma frase repetida 3+ vezes consecutivas?
    if (i >= 2) {
      const t0 = (segments[i - 2].text || "").trim().toLowerCase();
      const t1 = (segments[i - 1].text || "").trim().toLowerCase();
      const t2 = text.toLowerCase();
      if (t0 === t1 && t1 === t2 && t0.length > 0) {
        console.log(`🎵 [Filter] Removido (repetição 3x): "${text.slice(0, 70)}"`);
        removed++;
        continue;
      }
    }

    result.push(segments[i]);
  }

  if (removed > 0) {
    console.log(`🎵 [Filter] Total removidos: ${removed}/${segments.length} segmentos de música`);
  } else {
    console.log(`🎵 [Filter] Nenhum segmento de música detectado (${segments.length} segmentos OK)`);
  }

  return result;
}

/**
 * Analisa o transcript e devolve EXACTAMENTE clipCount momentos virais.
 *
 * Pipeline:
 *   1. Primeira chamada ao GPT — pede safeCount momentos
 *   2. Se faltar, segunda chamada — pede apenas os momentos em falta,
 *      evitando os timestamps já seleccionados
 *   3. Se ainda faltar, fallback por score de densidade do transcript
 *   4. Validação final com log claro
 */
async function analyzeViralMoments({ transcript, clipLength, clipCount }) {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    throw new Error("Invalid transcript");
  }

  const safeCount  = Math.max(1, Number(clipCount)  || 5);
  const safeLength = Math.max(5, Number(clipLength) || 30);

  // Filtrar segmentos de música/louvor antes de enviar ao GPT
  const filtered = filterMusicSegments(transcript);
  if (filtered.length === 0) {
    throw new Error("[AI] Transcript vazio após filtro de música — sem conteúdo de pregação detectado");
  }

  const simplified = filtered.map((seg) => ({
    text:  seg.text,
    start: seg.start,
    end:   seg.end,
  }));

  const videoStart = simplified[0].start ?? 0;
  const videoEnd   = simplified[simplified.length - 1].end ?? 0;

  // ── 1. Primeira chamada ──────────────────────────────────────────────────
  console.log(`🤖 [AI] 1ª chamada — a pedir ${safeCount} momentos...`);
  let moments = await callGPT({
    simplified,
    videoEnd,
    safeCount,
    safeLength,
    exclude: [],
  });

  console.log(`✅ [AI] 1ª chamada devolveu ${moments.length}/${safeCount} momentos`);

  // ── 2. Segunda chamada se ainda faltarem clips ───────────────────────────
  if (moments.length < safeCount) {
    const missing = safeCount - moments.length;
    console.warn(`⚠️  [AI] Faltam ${missing} clips — a fazer 2ª chamada...`);

    const extra = await callGPT({
      simplified,
      videoEnd,
      safeCount: missing,
      safeLength,
      exclude: moments,
    });

    console.log(`✅ [AI] 2ª chamada devolveu ${extra.length}/${missing} momentos adicionais`);
    moments = deduplicateAndMerge(moments, extra);
  }

  // ── 3. Fallback por densidade do transcript ──────────────────────────────
  if (moments.length < safeCount) {
    const stillMissing = safeCount - moments.length;
    console.warn(`⚠️  [AI] Ainda faltam ${stillMissing} — a usar fallback por densidade...`);

    const fallback = fillByDensity(moments, safeCount, safeLength, simplified, videoStart, videoEnd);
    moments = fallback;
  }

  // ── 4. Validação final ───────────────────────────────────────────────────
  moments = moments.slice(0, safeCount).sort((a, b) => a.startTime - b.startTime);

  if (moments.length < safeCount) {
    console.error(
      `❌ [AI] VALIDAÇÃO FINAL FALHOU: gerados ${moments.length}/${safeCount} clips. ` +
      `Vídeo de ${Math.round(videoEnd)}s pode não ter conteúdo suficiente para ${safeCount} clips de ${safeLength}s.`
    );
  } else {
    console.log(`✅ [AI] Validação final OK: ${moments.length}/${safeCount} clips gerados`);
  }

  moments.forEach((m, i) => {
    console.log(
      `📋 [AI] Clip ${i + 1}: ${m.startTime}s–${m.endTime}s | ` +
      `score=${m.emotionScore} type=${m.momentType} | ` +
      `hook="${(m.hook || "").slice(0, 60)}" | ` +
      `thumb="${m.thumbnailText || ""}"`
    );
  });

  return moments;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Chamada ao GPT
// ─────────────────────────────────────────────────────────────────────────────

async function callGPT({ simplified, videoEnd, safeCount, safeLength, exclude }) {
  const excludeNote = exclude.length > 0
    ? `\nAlready selected (DO NOT overlap these):\n${JSON.stringify(exclude.map(m => ({ start: m.startTime, end: m.endTime })))}`
    : "";

  const prompt = `You are an expert viral content editor for TikTok, Instagram Reels, and YouTube Shorts specialising in church sermon and teaching content.

Transcript (JSON):
${JSON.stringify(simplified).slice(0, 12000)}

Video total duration: ${Math.round(videoEnd)}s${excludeNote}

Task: Select exactly ${safeCount} viral moment(s) from this transcript.

⚠️ CONTENT TYPE: This is a church service recording. It contains a mix of PREACHING/TEACHING and WORSHIP/MUSIC sections.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT RULES — STRICTLY FOLLOW (violations = wrong output):
1. ONLY select moments where a pastor/preacher is speaking, teaching or preaching
2. NEVER select moments with worship music, singing, or congregational singing
3. NEVER select moments where the audience/congregation is singing or responding in song
4. The selected moments must contain SPOKEN WORDS only — no music, no singing
5. If a moment has background music but someone is speaking, it is acceptable
6. Prioritize moments with: powerful statements, biblical teaching, emotional testimony, life-changing insights
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOW TO IDENTIFY WORSHIP/MUSIC (DO NOT SELECT):
- Repeated lyrics or chorus lines (same phrase repeated 2+ times)
- Words like "hallelujah", "glory", "praise", "worship", "amen" used as song lyrics
- Short fragmented words without complete sentences
- No biblical explanation or teaching structure
- Congregation or worship leader singing together

HOW TO IDENTIFY PREACHING (SELECT FROM HERE ONLY):
- Complete sentences explaining scripture, theology, or life principles
- Pastor addressing the congregation ("you need to...", "God wants...", "the Bible says...")
- Stories, illustrations, or examples that make a theological point
- Questions posed to the congregation followed by answers/teaching
- Direct commands or calls to action rooted in scripture
- Emotional personal testimony or confession from the preacher

VIRAL MOMENT CRITERIA (within preaching sections only) — prioritise in this order:
1. Emotional peaks — vulnerability, raw honesty, breakthrough moment
2. Powerful revelations or surprising biblical insights that reframe everything
3. Story climax — the moment a personal story or illustration lands
4. Bold declarations of faith or challenging calls to action
5. Quotable one-liners — short, punchy, theologically rich phrases
6. Moments of humour or congregation engagement within the sermon

STRICTLY AVOID:
- Any worship song, chorus, or musical interlude — even if it sounds powerful
- Intros and self-introductions ("Good morning, welcome...")
- Offering announcements, event announcements, housekeeping
- Closing prayer or benediction
- Filler content ("um", "so", "anyway")
- Overlapping with already-selected moments

REQUIREMENTS:
- Return EXACTLY ${safeCount} moment(s) — this is mandatory
- Each moment must be ~${safeLength}s long (endTime - startTime ≈ ${safeLength})
- Moments must be non-overlapping
- Start/end times must be within [0, ${Math.round(videoEnd)}]
- ALL selected moments must be from spoken preaching/teaching, NEVER from music or worship singing

OUTPUT FORMAT — for each moment return:
- startTime: number (seconds)
- endTime: number (seconds)
- emotionScore: integer 1–10 (10 = maximum emotional impact / viral potential)
- momentType: one of "testimony" | "revelation" | "declaration" | "teaching" | "climax" | "humor" | "challenge"
  • testimony  — personal story or emotional confession
  • revelation — surprising biblical insight that reframes everything
  • declaration — bold statement of faith or identity
  • teaching   — clear biblical principle or explanation
  • climax     — turning point of a story or illustration
  • humor      — funny moment or witty line
  • challenge  — direct call to action rooted in scripture
- hook: string — ONE sentence (<15 words) in English that hooks the viewer in the first 3 seconds.
  Must create curiosity, surprise, or emotion. Start with the action/tension, not "In this clip..."
  Examples: "He gave away everything — and got back more than he imagined."
            "Your biggest fear is the exact door God wants you to walk through."
- thumbnailText: string — SHORT title (<6 words) for thumbnail overlay. Punchy, creates curiosity or emotion.
  Examples: "He Lost Everything", "God's Hidden Secret", "The Moment Everything Changed"

CRITICAL: Return ONLY a raw JSON array. No markdown, no explanation, no wrapper.
[{"startTime":<n>,"endTime":<n>,"emotionScore":<n>,"momentType":"<type>","hook":"<text>","thumbnailText":"<text>"}, ...]`;

  let response;
  try {
    response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a JSON-only viral clip selector for church sermon content. Select ONLY from preaching/teaching segments — never from worship music or song lyrics. Return a raw JSON array with EXACTLY ${safeCount} element(s), each with startTime, endTime, emotionScore, momentType, hook, and thumbnailText. Nothing else.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    });
  } catch (err) {
    console.error("❌ [AI] OpenAI API error:", err.message);
    return [];
  }

  let content = response.choices?.[0]?.message?.content;
  if (!content) return [];

  content = content.replace(/```json/gi, "").replace(/```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("❌ [AI] Parse error:", content.slice(0, 300));
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const VALID_TYPES = new Set(["testimony","revelation","declaration","teaching","climax","humor","challenge"]);

  return parsed
    .filter(m => typeof m.startTime === "number" && typeof m.endTime === "number")
    .filter(m => m.endTime > m.startTime)
    .map(m => ({
      startTime:     Number(m.startTime.toFixed(2)),
      endTime:       Number(m.endTime.toFixed(2)),
      emotionScore:  typeof m.emotionScore === "number" ? Math.min(10, Math.max(1, Math.round(m.emotionScore))) : 5,
      momentType:    VALID_TYPES.has(m.momentType) ? m.momentType : "teaching",
      hook:          typeof m.hook === "string"          ? m.hook.trim()          : "",
      thumbnailText: typeof m.thumbnailText === "string" ? m.thumbnailText.trim() : "",
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
//  Merge sem duplicados/sobreposições
// ─────────────────────────────────────────────────────────────────────────────

function deduplicateAndMerge(existing, candidates) {
  const result = [...existing];

  for (const c of candidates) {
    const overlaps = result.some(
      e => c.startTime < e.endTime && c.endTime > e.startTime
    );
    if (!overlaps) result.push(c);
  }

  return result.sort((a, b) => a.startTime - b.startTime);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Fallback: preencher por densidade de palavras no transcript
//  Divide o tempo livre em slots de clipLength e score cada slot
//  pela quantidade de texto do transcript que contém.
// ─────────────────────────────────────────────────────────────────────────────

function fillByDensity(existing, targetCount, clipLength, transcript, videoStart, videoEnd) {
  if (videoEnd <= videoStart) return existing;

  const sorted   = [...existing].sort((a, b) => a.startTime - b.startTime);
  const freeSlots = generateFreeSlots(sorted, videoStart, videoEnd, clipLength);

  // Score cada slot pela densidade de texto do transcript
  const scored = freeSlots.map(slot => {
    const words = transcript.reduce((sum, seg) => {
      const overlap = Math.min(seg.end, slot.endTime) - Math.max(seg.start, slot.startTime);
      return sum + (overlap > 0 ? (seg.text || "").split(/\s+/).length : 0);
    }, 0);
    return { ...slot, score: words };
  });

  // Ordenar por score descendente — slots com mais conteúdo primeiro
  scored.sort((a, b) => b.score - a.score);

  const result = [...sorted];

  for (const slot of scored) {
    if (result.length >= targetCount) break;
    // Verificar sobreposição (segurança extra)
    const overlaps = result.some(
      e => slot.startTime < e.endTime && slot.endTime > e.startTime
    );
    if (!overlaps) {
      result.push({
        startTime:     slot.startTime,
        endTime:       slot.endTime,
        emotionScore:  5,
        momentType:    "teaching",
        hook:          "",
        thumbnailText: "",
      });
    }
  }

  return result.sort((a, b) => a.startTime - b.startTime);
}

function generateFreeSlots(sorted, videoStart, videoEnd, clipLength) {
  const occupied    = sorted.map(m => ({ start: m.startTime, end: m.endTime }));
  const freeRegions = [];
  let cursor        = videoStart;

  for (const seg of occupied) {
    if (seg.start > cursor) freeRegions.push({ start: cursor, end: seg.start });
    cursor = Math.max(cursor, seg.end);
  }
  if (cursor < videoEnd) freeRegions.push({ start: cursor, end: videoEnd });

  // Regiões maiores primeiro
  freeRegions.sort((a, b) => (b.end - b.start) - (a.end - a.start));

  const slots = [];
  for (const region of freeRegions) {
    let t = region.start;
    while (t + clipLength <= region.end) {
      slots.push({
        startTime: Number(t.toFixed(2)),
        endTime:   Number((t + clipLength).toFixed(2)),
      });
      t += clipLength;
    }
  }

  return slots;
}

// ─────────────────────────────────────────────────────────────────────────────
//  analyzeMomentsOnly
//  Pipeline mode: análise pura sem clip assembly.
//  Usa o transcript COMPLETO (sem truncar), deixa o GPT definir as fronteiras
//  naturais de cada momento (sem clipLength fixo).
//
//  Input:  { transcript: Segment[], clipCount: number }
//  Output: { moments: [{ startTime, endTime, duration, hook }] }
// ─────────────────────────────────────────────────────────────────────────────

async function analyzeMomentsOnly({ transcript, clipCount }) {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    throw new Error("[analyzeMomentsOnly] transcript vazio ou inválido");
  }

  const safeCount = Math.max(1, Number(clipCount) || 5);

  // Filtrar música antes de enviar ao GPT
  const filtered = filterMusicSegments(transcript);
  if (filtered.length === 0) {
    throw new Error("[analyzeMomentsOnly] Transcript vazio após filtro de música");
  }

  // Formato compacto para maximizar contexto sem truncar
  // Cada segmento → { s, e, t } em vez do objeto completo com words[]
  const compact = filtered.map(seg => ({
    s: Number((seg.start ?? 0).toFixed(2)),
    e: Number((seg.end   ?? 0).toFixed(2)),
    t: (seg.text || "").trim(),
  }));

  const videoStart = compact[0].s;
  const videoEnd   = compact[compact.length - 1].e;

  console.log(
    `🎯 [analyzeMomentsOnly] ${compact.length} segmentos | ` +
    `${Math.round(videoEnd)}s de conteúdo | a pedir ${safeCount} momentos`
  );

  // ── Chamada ao GPT (full transcript, natural boundaries) ──────────────────
  const moments = await callGPTNaturalBoundaries({ compact, clipCount: safeCount, videoEnd });

  // ── Validação ─────────────────────────────────────────────────────────────
  if (moments.length < safeCount) {
    console.warn(
      `⚠️  [analyzeMomentsOnly] GPT devolveu ${moments.length}/${safeCount} momentos. ` +
      `Conteúdo insuficiente para preencher todos os clips pedidos.`
    );
  }

  console.log(`✅ [analyzeMomentsOnly] ${moments.length} momentos finais:`);
  moments.forEach((m, i) =>
    console.log(`  ${i + 1}. ${m.startTime}s–${m.endTime}s (${m.duration}s) — "${(m.hook || "").slice(0, 60)}"`)
  );

  return { moments };
}

// ─────────────────────────────────────────────────────────────────────────────
//  callGPTNaturalBoundaries
//  Versão sem clipLength fixo — o GPT escolhe os limites naturais do discurso.
//  Usa timestamps exactos dos segmentos para garantir cortes limpos.
// ─────────────────────────────────────────────────────────────────────────────

async function callGPTNaturalBoundaries({ compact, clipCount, videoEnd }) {
  // Transcript COMPLETO em formato compacto — sem slice, sem truncar
  const transcriptJson = JSON.stringify(compact);

  const prompt = `You are a viral content editor specialising in church sermon clips for TikTok, Instagram Reels, and YouTube Shorts.

TRANSCRIPT (format: [{s: startSeconds, e: endSeconds, t: "text"}, ...]):
${transcriptJson}

Total duration: ${Math.round(videoEnd)}s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK: Select EXACTLY ${clipCount} moments with the highest viral potential.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BOUNDARY RULES (MANDATORY — violations = wrong output):
1. startTime MUST equal the "s" value of a segment where a new complete thought BEGINS
2. endTime MUST equal the "e" value of a segment where a complete thought ENDS
3. NEVER cut mid-sentence — startTime and endTime must be exact segment boundaries
4. Each moment must be SELF-CONTAINED — understandable with no context from outside
5. Select as many consecutive segments as needed to capture a complete thought
6. No fixed duration — let the natural length of the idea define the clip

CONTENT RULES:
- ONLY select moments from PREACHING or TEACHING — spoken words by the pastor
- NEVER select worship music, singing, or congregational responses
- NO overlapping moments
- Sort results: best quality first (index 0 = highest viral potential)

PRIORITY ORDER (rank by this):
1. Raw emotional moment — pastor breaks down, confesses vulnerability, cries
2. Revelation — surprising insight that completely reframes a belief
3. Story climax — the turning point where a personal story lands its lesson
4. Bold declaration — a statement of faith so sharp it hits like a punch
5. Challenge — a call to action that creates immediate conviction or urgency

HOOK RULES:
- Write ONE sentence in English, under 15 words
- Must grab attention in the first 3 seconds
- Use curiosity, surprise, or emotional tension
- Start with the action or tension — NEVER with "In this clip..." or "Here..."
- Examples:
  "He gave everything away — and then God showed up."
  "The moment he stopped praying was the moment everything changed."
  "Your biggest fear is the exact door God wants you to walk through."

OUTPUT — return ONLY this JSON, no markdown, no explanation:
{"moments":[{"startTime":<s>,"endTime":<e>,"duration":<e-s>,"hook":"<text>"},...]}`;

  let response;
  try {
    response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a JSON-only viral clip selector. Return a raw JSON object with a "moments" array containing EXACTLY ${clipCount} element(s). Use ONLY segment boundary timestamps from the transcript. Never truncate a thought. Nothing else.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    });
  } catch (err) {
    console.error("❌ [analyzeMomentsOnly] OpenAI error:", err.message);
    return [];
  }

  let content = response.choices?.[0]?.message?.content;
  if (!content) return [];

  content = content.replace(/```json/gi, "").replace(/```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("❌ [analyzeMomentsOnly] Parse error:", content.slice(0, 400));
    return [];
  }

  // Aceita tanto { moments: [...] } como [...] directamente
  const raw = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.moments) ? parsed.moments : []);

  // Validar que os timestamps existem no transcript (segurança)
  const validStarts = new Set(compact.map(s => s.s));
  const validEnds   = new Set(compact.map(s => s.e));

  return raw
    .filter(m => typeof m.startTime === "number" && typeof m.endTime === "number")
    .filter(m => m.endTime > m.startTime)
    .filter(m => {
      const startOk = validStarts.has(Number(m.startTime.toFixed(2)));
      const endOk   = validEnds.has(Number(m.endTime.toFixed(2)));
      if (!startOk || !endOk) {
        console.warn(`⚠️  [analyzeMomentsOnly] Timestamp inválido descartado: ${m.startTime}–${m.endTime}`);
      }
      return startOk && endOk;
    })
    .map(m => ({
      startTime: m.startTime,
      endTime:   m.endTime,
      duration:  Number((m.endTime - m.startTime).toFixed(2)),
      hook:      typeof m.hook === "string" ? m.hook.trim() : "",
    }))
    .slice(0, clipCount);
}

module.exports = { analyzeViralMoments, analyzeMomentsOnly };
