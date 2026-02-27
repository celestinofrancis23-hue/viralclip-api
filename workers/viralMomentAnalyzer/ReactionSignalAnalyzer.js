/**
 * ReactionSignalAnalyzer
 * -----------------------
 * Objetivo:
 * Detectar sinais de reação emocional / audiência
 * Contrato rígido de entrada e saída
 */

module.exports = function ReactionSignalAnalyzer({
  enrichedBlocks,
  language,
  clipLength
}) {
  // ==============================
  // VALIDAÇÕES DE CONTRATO
  // ==============================
  if (!Array.isArray(enrichedBlocks)) {
    throw new Error("[ReactionSignalAnalyzer] enrichedBlocks inválido");
  }

  if (typeof clipLength !== "number") {
    throw new Error("[ReactionSignalAnalyzer] clipLength inválido");
  }

  // ==============================
  // PROCESSAMENTO
  // ==============================
  const reactiveBlocks = enrichedBlocks.map((block, index) => {
    const hasReaction =
      block.interaction?.hasInteraction === true &&
      block.interaction.intensity >= 0.5;

    return {
      blockId: index,
      start: block.start,
      end: block.end,
      reaction: {
        hasReaction,
        type: hasReaction ? "audience_engagement" : null,
        intensity: hasReaction ? block.interaction.intensity : 0
      }
    };
  });

  // ==============================
  // RETURN CONTRATUAL (CRÍTICO)
  // ==============================
  return {
    reactiveBlocks
  };
};
