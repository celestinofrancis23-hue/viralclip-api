// DebateWorker.js

/**
 * Detecta momentos de INTERAÇÃO / DEBATE / TROCA conversacional.
 * Ideal para podcasts, entrevistas e mesas redondas.
 */

const QUESTION_PATTERNS = [
  /\?$/,
  /\b(what do you think|do you agree|right|não acha|o que você acha|tu achas|estás a dizer)\b/i
];

const DISAGREEMENT_PATTERNS = [
  /\b(i disagree|i don't agree|but i think|não concordo|discordo|mas acho)\b/i
];

const REACTION_PATTERNS = [
  /\b(wow|oh|ah|haha|interesting|interessante|caramba|uau)\b/i
];

/**
 * Helpers
 */
function isQuestion(text) {
  return QUESTION_PATTERNS.some((p) => p.test(text));
}

function isDisagreement(text) {
  return DISAGREEMENT_PATTERNS.some((p) => p.test(text));
}

function isReaction(text) {
  return REACTION_PATTERNS.some((p) => p.test(text));
}

/**
 * Worker principal
 */
function DebateWorker(transcriptSegments = []) {
  if (!Array.isArray(transcriptSegments)) {
    throw new Error("[DebateWorker] transcriptSegments must be an array");
  }

  const results = [];

  for (let i = 0; i < transcriptSegments.length - 1; i++) {
    const current = transcriptSegments[i];
    const next = transcriptSegments[i + 1];

    if (!current || !next) continue;
    if (typeof current.text !== "string") continue;
    if (typeof next.text !== "string") continue;

    const currentText = current.text.trim();
    const nextText = next.text.trim();

    let score = 0;
    let reasons = [];

    // Pergunta → resposta
    if (isQuestion(currentText)) {
      score += 1;
      reasons.push("question");
    }

    // Discordância
    if (isDisagreement(nextText)) {
      score += 1;
      reasons.push("disagreement");
    }

    // Reação emocional
    if (isReaction(nextText)) {
      score += 0.5;
      reasons.push("reaction");
    }

    // Troca de speaker (se existir metadata)
    if (
      current.speaker &&
      next.speaker &&
      current.speaker !== next.speaker
    ) {
      score += 1;
      reasons.push("speaker_change");
    }

    // Threshold mínimo
    if (score >= 1.5) {
      results.push({
        start: current.start,
        reason: "debate_interaction",
        confidence: 0.2 + score * 0.05, // normalmente entre 0.25 e 0.35
        text: currentText,
        meta: {
          reasons
        }
      });
    }
  }

  return results;
}

module.exports = DebateWorker;
