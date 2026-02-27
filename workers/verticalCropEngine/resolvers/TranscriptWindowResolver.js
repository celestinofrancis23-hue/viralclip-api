// workers/verticalCropEngine/resolvers/TranscriptWindowResolver.js

module.exports = function TranscriptWindowResolver({
  transcriptSegments = [],
  clipStart,
  clipEnd
}) {
  if (!Array.isArray(transcriptSegments)) {
    throw new Error("[TranscriptWindowResolver] transcriptSegments inválido");
  }

  if (typeof clipStart !== "number" || typeof clipEnd !== "number") {
    throw new Error("[TranscriptWindowResolver] clipStart / clipEnd inválidos");
  }

  if (clipEnd <= clipStart) {
    throw new Error("[TranscriptWindowResolver] clipEnd <= clipStart");
  }

  // ===============================
  // Recorte por interseção temporal
  // ===============================
  const clipTranscriptSegments = transcriptSegments
    .filter(seg => {
      // Interseção com o intervalo do clip
      return seg.end > clipStart && seg.start < clipEnd;
    })
    .map(seg => {
      // Ajuste para tempo relativo ao clip
      const relativeStart = Math.max(seg.start, clipStart) - clipStart;
      const relativeEnd = Math.min(seg.end, clipEnd) - clipStart;

      return {
        start: Number(relativeStart.toFixed(3)),
        end: Number(relativeEnd.toFixed(3)),
        text: seg.text
      };
    })
    .filter(seg => seg.end > seg.start); // segurança extra

  return {
    clipTranscriptSegments,
    clipDuration: Number((clipEnd - clipStart).toFixed(3))
  };
};
