// workers/WordSplitterWorker.js

const { createWord, validateWord } = require("../contracts/caption/Word.contract");

module.exports = function WordSplitterWorker({
  clipIndex,
  segments,
}) {
  // ==============================
  // Validações iniciais
  // ==============================

  if (!Number.isInteger(clipIndex)) {
    throw new Error("[WordSplitterWorker] clipIndex inválido");
  }

  if (!Array.isArray(segments)) {
    throw new Error("[WordSplitterWorker] segments deve ser um array");
  }

  const words = [];
  let globalWordIndex = 0;

  // ==============================
  // Processamento
  // ==============================

  for (const segment of segments) {
    if (!segment) continue;

    const { text, start, end } = segment;

    // valida estrutura mínima do segmento
    if (typeof text !== "string") continue;
    if (typeof start !== "number") continue;
    if (typeof end !== "number") continue;

    const cleanText = text.trim();
    if (!cleanText) continue;

    const tokens = cleanText.split(/\s+/);
    if (!tokens.length) continue;

    const segmentDuration = Math.max(end - start, 0.01);
    const wordDuration = segmentDuration / tokens.length;

    tokens.forEach((token, tokenIndex) => {
      if (!token) return;

      const wordStart = start + tokenIndex * wordDuration;
      const wordEnd = wordStart + wordDuration;

      const word = createWord({
        index: globalWordIndex,
        text: token,
        start: wordStart,
        end: wordEnd,
        clipIndex,
      });

      validateWord(word);

      words.push(word);
      globalWordIndex++;
    });
  }

  return words;
};
