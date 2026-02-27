// NaturalStartWorker.js

/**
 * Detecta inícios NATURAIS de fala.
 * Complementa o StrongPhraseWorker.
 */

const NATURAL_START_PATTERNS = [
  // ===== ENGLISH =====
  /^\s*(so|well|today|now|look|okay|alright|let me|i want to|we need to)\b/i,

  // ===== PORTUGUESE =====
  /^\s*(então|bom|olha|hoje|agora|deixa eu|quero falar|vamos falar)\b/i,

  // ===== SPANISH =====
  /^\s*(entonces|bueno|mira|hoy|ahora|déjame|quiero hablar)\b/i,

  // ===== FRENCH =====
  /^\s*(alors|bon|écoute|aujourd’hui|maintenant|je veux|laisse-moi)\b/i,

  // ===== GENERIC HUMAN OPENERS =====
  /^\s*(the thing is|what happens is|here’s the thing)\b/i
];

/**
 * Verifica se a frase parece um início natural
 */
function isNaturalStart(text) {
  if (!text || text.length < 8) return false;

  return NATURAL_START_PATTERNS.some((pattern) =>
    pattern.test(text.trim())
  );
}

/**
 * Worker principal
 */
function NaturalStartWorker(transcriptSegments = []) {
  if (!Array.isArray(transcriptSegments)) {
    throw new Error("[NaturalStartWorker] transcriptSegments must be an array");
  }

  const results = [];

  for (const segment of transcriptSegments) {
    if (!segment || typeof segment.text !== "string") continue;

    const text = segment.text.trim();

    if (isNaturalStart(text)) {
      results.push({
        start: segment.start,
        reason: "natural_start",
        confidence: 0.25, // menor prioridade que strong_phrase
        text
      });
    }
  }

  return results;
}

module.exports = NaturalStartWorker;
