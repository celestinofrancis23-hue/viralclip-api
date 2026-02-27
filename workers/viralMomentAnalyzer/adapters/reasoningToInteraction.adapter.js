/**
 * Reasoning → Interaction Adapter
 * Normaliza reasoningBlocks para um formato simples e estável
 */

module.exports = function reasoningToInteractionAdapter({ reasoningBlocks }) {
  if (!Array.isArray(reasoningBlocks)) {
    throw new Error("[Adapter] reasoningBlocks inválido ou ausente");
  }

  return reasoningBlocks.map((block, index) => {
    if (
      typeof block.start !== "number" ||
      typeof block.end !== "number" ||
      typeof block.text !== "string"
    ) {
      throw new Error(`[Adapter] Block inválido no índice ${index}`);
    }

    return {
      blockId: index,
      start: block.start,
      end: block.end,
      duration: block.end - block.start,
      text: block.text,
      confidence: typeof block.confidence === "number" ? block.confidence : 0.5
    };
  });
};
