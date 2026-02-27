// ActionEnergyWorker.js

/**
 * Detecta momentos de AÇÃO / ENERGIA / RITMO
 * MVP sem visão computacional — apenas transcript + timing
 */

const ENERGY_PATTERNS = [
  /\b(oh|wow|whoa|hey|ah|haha|lol|uau|caramba)\b/i,
  /!+$/,
];

/**
 * Helpers
 */
function hasEnergyExpression(text) {
  return ENERGY_PATTERNS.some((p) => p.test(text));
}

function segmentDuration(segment) {
  if (typeof segment.start !== "number" || typeof segment.end !== "number") {
    return null;
  }
  return segment.end - segment.start;
}

/**
 * Worker principal
 */
function ActionEnergyWorker(transcriptSegments = []) {
  if (!Array.isArray(transcriptSegments)) {
    throw new Error("[ActionEnergyWorker] transcriptSegments must be an array");
  }

  const results = [];

  for (let i = 0; i < transcriptSegments.length - 1; i++) {
    const current = transcriptSegments[i];
    const next = transcriptSegments[i + 1];

    if (!current || !next) continue;
    if (typeof current.text !== "string") continue;

    const text = current.text.trim();
    const duration = segmentDuration(current);

    let score = 0;
    let reasons = [];

    // 1️⃣ Exclamações / reações curtas
    if (hasEnergyExpression(text)) {
      score += 1;
      reasons.push("energy_expression");
    }

    // 2️⃣ Segmento muito curto → possível ação
    if (duration !== null && duration < 1.2) {
      score += 0.5;
      reasons.push("short_segment");
    }

    // 3️⃣ Mudança brusca de ritmo (gap pequeno)
    const gap = next.start - current.end;
    if (gap !== null && gap >= 0 && gap < 0.4) {
      score += 0.5;
      reasons.push("fast_transition");
    }

    // Threshold mínimo
    if (score >= 1) {
      results.push({
        start: current.start,
        reason: "action_energy",
        confidence: Math.min(0.3, 0.15 + score * 0.1),
        text,
        meta: {
          reasons
        }
      });
    }
  }

  return results;
}

module.exports = ActionEnergyWorker;
