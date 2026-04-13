const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analisa o transcript e devolve EXACTAMENTE clipCount momentos virais.
 * Se o modelo retornar menos, preenche com os melhores momentos restantes.
 */
async function analyzeViralMoments({ transcript, clipLength, clipCount }) {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    throw new Error("Invalid transcript");
  }

  const safeCount  = Math.max(1, Number(clipCount)  || 5);
  const safeLength = Math.max(5, Number(clipLength) || 30);

  // Simplificar payload (evitar exceder context)
  const simplified = transcript.map((seg) => ({
    text:  seg.text,
    start: seg.start,
    end:   seg.end,
  }));

  const videoEnd = simplified[simplified.length - 1].end || 0;

  const prompt = `You are an expert viral content editor for short-form video (TikTok/Reels/Shorts).

Transcript (JSON):
${JSON.stringify(simplified).slice(0, 12000)}

Video total duration: ${Math.round(videoEnd)}s

Task: Select exactly ${safeCount} viral moments from this transcript.

Requirements:
- You MUST return EXACTLY ${safeCount} moments — no more, no fewer
- Each moment must be approximately ${safeLength} seconds long (endTime - startTime ≈ ${safeLength})
- Moments must be non-overlapping
- Prioritise: emotional peaks, strong opinions, surprising facts, humour, calls to action
- Avoid: intros, outros, sponsorship reads, filler phrases

CRITICAL: Return ONLY a raw JSON array. No markdown. No explanation. No wrapper object.
The array must contain EXACTLY ${safeCount} objects.

Format:
[{"startTime": <number>, "endTime": <number>}, ...]`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a JSON-only viral clip selector. You always return a raw JSON array with EXACTLY ${safeCount} elements and nothing else.`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3, // menos aleatoriedade → mais consistente na contagem
  });

  let content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty AI response");
  }

  // Limpar possíveis marcadores markdown
  content = content
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error("❌ AI PARSE ERROR:", content.slice(0, 500));
    throw new Error("Failed to parse AI response");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI returned invalid format (expected array)");
  }

  // Normalizar e validar cada momento
  parsed = parsed
    .filter(m => typeof m.startTime === "number" && typeof m.endTime === "number")
    .filter(m => m.endTime > m.startTime)
    .map(m => ({
      startTime: Number(m.startTime.toFixed(2)),
      endTime:   Number(m.endTime.toFixed(2)),
    }));

  console.log(`✅ AI devolveu ${parsed.length}/${safeCount} momentos`);

  // ── Garantir exactamente safeCount momentos ─────────────────────────────
  if (parsed.length > safeCount) {
    parsed = parsed.slice(0, safeCount);
  }

  if (parsed.length < safeCount) {
    console.warn(`⚠️  AI devolveu ${parsed.length} — a preencher até ${safeCount}`);
    parsed = fillMissingMoments(parsed, safeCount, safeLength, simplified);
  }

  console.log(`📋 Momentos finais (${parsed.length}):`, parsed);

  return parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Fill-up: encontra os melhores intervalos livres para os clips em falta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Preenche `existing` até `targetCount` clips distribuindo slots livres
 * pelo vídeo. Gera candidatos em todas as zonas não cobertas pelos clips
 * já existentes, avançando de clipLength em clipLength.
 */
function fillMissingMoments(existing, targetCount, clipLength, transcript) {
  const videoStart = transcript[0]?.start ?? 0;
  const videoEnd   = transcript[transcript.length - 1]?.end ?? 0;

  if (videoEnd <= videoStart) return existing;

  const sorted  = [...existing].sort((a, b) => a.startTime - b.startTime);
  const slots   = generateFreeSlots(sorted, videoStart, videoEnd, clipLength);
  const result  = [...sorted];

  for (const slot of slots) {
    if (result.length >= targetCount) break;
    result.push(slot);
  }

  return result.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Percorre o vídeo de clipLength em clipLength e devolve todos os
 * slots que não se sobrepõem com os clips já existentes.
 * Devolve ordenados por "espaço livre restante" — prefere zonas com
 * mais conteúdo disponível (maior gap).
 */
function generateFreeSlots(sorted, videoStart, videoEnd, clipLength) {
  // Construir lista de regiões ocupadas para lookup rápido
  const occupied = sorted.map(m => ({ start: m.startTime, end: m.endTime }));

  // Encontrar as regiões livres
  const freeRegions = [];
  let cursor = videoStart;

  for (const seg of occupied) {
    if (seg.start > cursor) {
      freeRegions.push({ start: cursor, end: seg.start });
    }
    cursor = Math.max(cursor, seg.end);
  }
  if (cursor < videoEnd) {
    freeRegions.push({ start: cursor, end: videoEnd });
  }

  // Ordenar por tamanho descendente — preencher primeiro onde há mais espaço
  freeRegions.sort((a, b) => (b.end - b.start) - (a.end - a.start));

  // Gerar slots dentro de cada região livre
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
