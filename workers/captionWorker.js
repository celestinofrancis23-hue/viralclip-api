// worker/captionWorker.js

const captionEngine = require("../engines/captionEngine");

module.exports = async function captionWorker(job) {
  console.log("[CaptionWorker] Iniciado");
  console.log("Job recebido no CaptionWorker:", job.jobId);
  console.log("Configurações:", job.settings);

  // Mock transcript word-level (simula Whisper)
  const mockTranscriptWords = [
    { word: "Olá", start: 0.2, end: 0.4 },
    { word: "mundo", start: 0.5, end: 0.9 },
    { word: "isso", start: 1.2, end: 1.4 },
    { word: "é", start: 1.5, end: 1.6 },
    { word: "um", start: 1.7, end: 1.8 },
    { word: "teste", start: 1.9, end: 2.2 },
  ];

  // Mock window (simula clip)
  const clipWindow = {
    start: 0.4,
    end: 1.6
  };

  const captions = captionEngine({
    transcriptWords: mockTranscriptWords,
    windowStart: clipWindow.start,
    windowEnd: clipWindow.end,
  });

  console.log("📝 Captions geradas:", captions);

  console.log("[CaptionWorker] Finalizado (engine conectado)");
};
