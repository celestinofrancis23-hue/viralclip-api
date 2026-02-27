/**
 * InteractionAnalyzer V1
 * Analisa interação direta com a audiência
 * Baseado apenas em TEXTO AGREGADO
 */

module.exports = function InteractionAnalyzer({ blocks }) {
  if (!Array.isArray(blocks)) {
    throw new Error("[InteractionAnalyzer] blocks inválido ou ausente");
  }

  const interactionPatterns = [
    { type: "QUESTION", regex: /\?/ },
    { type: "DIRECT_ADDRESS", regex: /\b(tu|vous|toi|te|vous|ton|ta|tes)\b/i },
    { type: "CALL_TO_ACTION", regex: /\b(regarde|écoute|viens|suis-moi|check)\b/i }
  ];

  const enrichedBlocks = blocks.map((block) => {
    if (
      typeof block.text !== "string" ||
      typeof block.start !== "number" ||
      typeof block.end !== "number"
    ) {
      throw new Error("[InteractionAnalyzer] Block malformado");
    }

    let detectedType = "NONE";
    let markers = [];
    let intensity = 0;

    for (const pattern of interactionPatterns) {
      if (pattern.regex.test(block.text)) {
        detectedType = pattern.type;
        markers.push(pattern.type);
        intensity = Math.max(intensity, 0.6);
      }
    }

    return {
      ...block,
      interaction: {
        hasInteraction: detectedType !== "NONE",
        type: detectedType,
        intensity,
        markers
      }
    };
  });

  return {
    enrichedBlocks,
    metadata: {
      totalBlocks: enrichedBlocks.length,
      interactionBlocks: enrichedBlocks.filter(
        (b) => b.interaction.hasInteraction
      ).length
    }
  };
};
