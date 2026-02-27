/**
 * Word Splitter
 * - Recebe segmentos filtrados de UM clip
 * - Divide texto em palavras
 * - Distribui o tempo proporcionalmente
 */

module.exports = function wordSplitter({ clipIndex, segments }) {
  if (!Array.isArray(segments)) {
    throw new Error(`[WordSplitter] segments inválido no clip ${clipIndex}`);
  }

  const words = [];

  for (const segment of segments) {
    const { start, end, text } = segment;

    if (
      typeof start !== "number" ||
      typeof end !== "number" ||
      typeof text !== "string"
    ) {
      continue;
    }

    const tokens = text
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (tokens.length === 0) continue;

    const duration = end - start;
    const wordDuration = duration / tokens.length;

    tokens.forEach((token, index) => {
      const wordStart = start + index * wordDuration;
      const wordEnd = wordStart + wordDuration;

      words.push({
        clipIndex,
        word: token,
        start: Number(wordStart.toFixed(3)),
        end: Number(wordEnd.toFixed(3)),
      });
    });
  }

  console.log(
    `[WordSplitter] ${words.length} palavras geradas (clip ${clipIndex})`
  );

  return words;
};
