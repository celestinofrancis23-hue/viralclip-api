/**
 * CandidateRanker
 * ----------------
 * Responsabilidade:
 * - Receber blocos já pontuados (scoredBlocks)
 * - Selecionar TODOS os bons pontos de início (seeds)
 * - Aplicar:
 *    • score mínimo
 *    • espaçamento mínimo entre candidatos
 *
 * ❌ NÃO decide quantidade final de clipes
 * ❌ NÃO usa clipCount
 * ❌ NÃO corta clipe
 *
 * Isso será responsabilidade do Assembler / Selector depois.
 */

module.exports = function CandidateRanker({
  scoredBlocks,
  minScore = 90,
  minGapSeconds = 10
}) {
  if (!Array.isArray(scoredBlocks)) {
    throw new Error("[CandidateRanker] scoredBlocks inválido");
  }

  // 1️⃣ Filtrar apenas blocos com score suficiente
  const eligibleBlocks = scoredBlocks
    .filter(block => typeof block.score === "number" && block.score >= minScore)
    .sort((a, b) => b.score - a.score); // score DESC

  if (eligibleBlocks.length === 0) {
    return {
      candidateSeeds: []
    };
  }

  // 2️⃣ Selecionar seeds respeitando espaçamento mínimo
  const candidateSeeds = [];

  for (const block of eligibleBlocks) {
    const tooClose = candidateSeeds.some(seed =>
      Math.abs(seed.seedStart - block.start) < minGapSeconds
    );

    if (tooClose) continue;

    candidateSeeds.push({
      seedStart: block.start,
      score: block.score,
      reason: "high_narrative_score"
    });
  }

  return {
    candidateSeeds
  };
};
