// workers/WordCaseNormalizerWorker.js

module.exports = function WordCaseNormalizerWorker(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("[WordCaseNormalizer] payload inválido");
  }

  const { words } = payload;

  if (!Array.isArray(words)) {
    throw new Error("[WordCaseNormalizer] words inválido (não é array)");
  }

  console.log("[WordCaseNormalizer] INPUT");
  console.log("words count:", words.length);
  console.log("sample word:", words[0]);

  const normalized = words.map((word, i) => {
    if (!word || typeof word !== "object") {
      throw new Error(`[WordCaseNormalizer] word inválida no índice ${i}`);
    }

    if (typeof word.text !== "string") {
      throw new Error(
        `[WordCaseNormalizer] word.text inválido no índice ${i}`
      );
    }

    return {
      ...word,
      text: word.text.toUpperCase(),
    };
  });

  console.log("[WordCaseNormalizer] OUTPUT");
  console.log("normalized count:", normalized.length);
  console.log("sample normalized:", normalized[0]);

  return normalized;
};
