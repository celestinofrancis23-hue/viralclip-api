const fs = require("fs");
const path = require("path");

module.exports = async function TranscriptPreprocessor({
  transcriptPath,
  mode,
  clipLength
}) {
  // ============================
  // 1. Validação
  // ============================
  if (!transcriptPath) {
    throw new Error("[TranscriptPreprocessor] transcriptPath não informado");
  }

  if (!fs.existsSync(transcriptPath)) {
    throw new Error(
      "[TranscriptPreprocessor] Transcript JSON não encontrado: " +
        transcriptPath
    );
  }

  if (!mode) {
    throw new Error("[TranscriptPreprocessor] mode não informado");
  }

  // ============================
  // 2. Leitura do transcript
  // ============================
  const raw = JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));

  const language = raw.language || null;
  const segmentsRaw = raw.segments || [];

  if (!Array.isArray(segmentsRaw) || segmentsRaw.length === 0) {
    throw new Error(
      "[TranscriptPreprocessor] Transcript não contém segmentos válidos"
    );
  }

  // ============================
  // 3. Normalização
  // ============================
  const segments = segmentsRaw.map((seg, index) => {
    const start = Number(seg.start.toFixed(2));
    const end = Number(seg.end.toFixed(2));

    return {
      id: index,
      start,
      end,
      duration: Number((end - start).toFixed(2)),
      text: (seg.text || "").trim(),
      words: Array.isArray(seg.words)
        ? seg.words.map(w => ({
            word: w.word,
            start: Number(w.start.toFixed(2)),
            end: Number(w.end.toFixed(2))
          }))
        : []
    };
  });

  // ============================
  // 4. Metadata
  // ============================
  const totalDuration =
    segments.length > 0 ? segments[segments.length - 1].end : 0;

  // ============================
  // 5. Output oficial
  // ============================
  return {
    mode,
    segments,
    metadata: {
      totalSegments: segments.length,
      totalDuration: Number(totalDuration.toFixed(2)),
      language
    }
  };
};
