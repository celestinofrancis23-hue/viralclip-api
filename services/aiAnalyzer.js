const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

  const simplified = transcript.map((seg) => ({
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

  console.log(`📋 Momentos finais (${moments.length}):`, moments);
  return moments;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Chamada ao GPT
// ─────────────────────────────────────────────────────────────────────────────

async function callGPT({ simplified, videoEnd, safeCount, safeLength, exclude }) {
  const excludeNote = exclude.length > 0
    ? `\nAlready selected (DO NOT overlap these):\n${JSON.stringify(exclude.map(m => ({ start: m.startTime, end: m.endTime })))}`
    : "";

  const prompt = `You are an expert viral content editor for TikTok, Instagram Reels, and YouTube Shorts.

Transcript (JSON):
${JSON.stringify(simplified).slice(0, 12000)}

Video total duration: ${Math.round(videoEnd)}s${excludeNote}

Task: Select exactly ${safeCount} viral moment(s) from this transcript.

VIRAL MOMENT CRITERIA — prioritise in this order:
1. Emotional peaks — crying, joy, shock, anger, vulnerability
2. Powerful revelations or surprising facts that reframe everything
3. Story climax or turning point — the moment everything changes
4. Personal stories or testimonials with strong emotional resonance
5. Bold opinions, controversial takes, or strong calls to action
6. Humour, unexpected reactions, or audience engagement moments
7. Quotable lines — short, punchy, memorable phrases

STRICTLY AVOID:
- Intros and self-introductions ("Hi, I'm...")
- Outros, thank-yous, sign-offs
- Sponsorship reads or product pitches
- Filler content ("um", "so", "anyway")
- Overlapping with already-selected moments

REQUIREMENTS:
- Return EXACTLY ${safeCount} moment(s) — this is mandatory
- Each moment must be ~${safeLength}s long (endTime - startTime ≈ ${safeLength})
- Moments must be non-overlapping
- Start/end times must be within [0, ${Math.round(videoEnd)}]

CRITICAL: Return ONLY a raw JSON array. No markdown, no explanation, no wrapper.
[{"startTime": <number>, "endTime": <number>}, ...]`;

  let response;
  try {
    response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a JSON-only viral clip selector. Return a raw JSON array with EXACTLY ${safeCount} element(s). Nothing else.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
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

  return parsed
    .filter(m => typeof m.startTime === "number" && typeof m.endTime === "number")
    .filter(m => m.endTime > m.startTime)
    .map(m => ({
      startTime: Number(m.startTime.toFixed(2)),
      endTime:   Number(m.endTime.toFixed(2)),
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
      result.push({ startTime: slot.startTime, endTime: slot.endTime });
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

module.exports = { analyzeViralMoments };
