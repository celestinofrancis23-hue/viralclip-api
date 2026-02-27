module.exports = function transcriptFilter({
  transcriptSegments,
  startTime,
  endTime,
}) {
  if (
    !Array.isArray(transcriptSegments) ||
    typeof startTime !== "number" ||
    typeof endTime !== "number"
  ) {
    throw new Error("[TranscriptFilter] Parâmetros inválidos");
  }

  console.log(
    `🧠 [TranscriptFilter] Intervalo ABS: ${startTime}s -> ${endTime}s`
  );

  const filtered = transcriptSegments
    .filter((segment) => segment.end > startTime && segment.start < endTime)
    .map((segment) => {
      const absStart = Math.max(segment.start, startTime);
      const absEnd = Math.min(segment.end, endTime);

      // ✅ converte para RELATIVO ao clip
      const relStart = absStart - startTime;
      const relEnd = absEnd - startTime;

      return {
        start: relStart,
        end: relEnd,
        text: segment.text,
      };
    })
    // ✅ segurança extra: remove coisas inválidas
    .filter((s) => typeof s.start === "number" && typeof s.end === "number" && s.end > s.start);

  console.log(`🧠 [TranscriptFilter] Segments filtrados: ${filtered.length}`);
  if (filtered[0]) console.log("🧠 [TranscriptFilter] Primeiro:", filtered[0]);
  if (filtered.at(-1)) console.log("🧠 [TranscriptFilter] Último:", filtered.at(-1));

  return filtered;
};
