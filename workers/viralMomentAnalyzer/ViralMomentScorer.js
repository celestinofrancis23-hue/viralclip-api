module.exports = function ViralMomentScorer({
  narrativeBlocks,
  clipLength
}) {
  if (!Array.isArray(narrativeBlocks)) {
    throw new Error("[ViralMomentScorer] narrativeBlocks inválido");
  }

  const scoredBlocks = narrativeBlocks.map((block) => {
    const duration = block.end - block.start;

    // 🔹 Boosts (máx 10)
    let boost = 0;

    // 1️⃣ Duração (até +3)
    const durationRatio = duration / clipLength;
    boost += Math.min(durationRatio * 3, 3);

    // 2️⃣ Interação (até +2)
    if (block.interaction?.hasInteraction) {
      boost += block.interaction.intensity * 2;
    }

    // 3️⃣ Reação (até +3)
    if (block.reaction?.hasReaction) {
      boost += block.reaction.intensity * 3;
    }

    // 4️⃣ Confiança do reasoning (até +1.5)
    if (typeof block.confidence === "number") {
      boost += block.confidence * 1.5;
    }

    // 5️⃣ Posição no vídeo (até +0.5)
    const positionRatio = block.start / clipLength;
    if (positionRatio < 0.33) boost += 0.5;

    // SCORE FINAL
    let score = 90 + boost;

    // Clamp final
    score = Math.min(Math.round(score), 100);

    return {
      ...block,
      score
    };
  });

  return { scoredBlocks };
};
