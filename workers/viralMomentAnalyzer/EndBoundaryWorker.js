// EndBoundaryWorker.js

/**
 * Define o fim real do clipe com base no transcript,
 * refinando o EndCandidate vindo do Ranker.
 */

function isGoodEnding(text = "") {
  const trimmed = text.trim();
  return (
    trimmed.endsWith(".") ||
    trimmed.endsWith("!") ||
    trimmed.endsWith("?")
  );
}

function EndBoundaryWorker({
  rankedClips = [],
  transcriptSegments = [],
  lookbackSeconds = 10,
}) {
  if (!Array.isArray(rankedClips)) {
    throw new Error("[EndBoundaryWorker] rankedClips inválido");
  }

  if (!Array.isArray(transcriptSegments)) {
    throw new Error("[EndBoundaryWorker] transcriptSegments inválido");
  }

  return rankedClips.map((clip) => {
    const { start, endCandidate } = clip;

    const windowStart = Math.max(start, endCandidate - lookbackSeconds);
    const windowEnd = endCandidate;

    // Segmentos dentro da janela de decisão
    const candidates = transcriptSegments.filter(
      (seg) =>
        seg.start >= windowStart &&
        seg.end <= windowEnd &&
        seg.text
    );

    // Preferir finais naturais
    const goodEnding = candidates
      .reverse()
      .find((seg) => isGoodEnding(seg.text));

    if (goodEnding) {
      return {
        ...clip,
        end: goodEnding.end,
        endText: goodEnding.text,
      };
    }

    // Fallback: corta seco no endCandidate
    return {
      ...clip,
      end: endCandidate,
      endText: null,
    };
  });
}

module.exports = EndBoundaryWorker;
