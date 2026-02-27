const path = require("path");

/**
 * Face Dominance Analyzer
 * Analisa frames do vídeo e identifica o rosto dominante ao longo do tempo
 */
module.exports = async function FaceDominanceAnalyzer({
  videoPath,
  clipDuration,
  speakerTimeline,
  fps = 5
}) {
  if (!videoPath) {
    throw new Error("[FaceDominanceAnalyzer] videoPath é obrigatório");
  }

  if (!speakerTimeline || !speakerTimeline.length) {
    return {
      faceTimeline: [],
      dominantFaceId: null
    };
  }

  // ============================
  // MOCK PROFISSIONAL (fase 1)
  // ============================
  // Aqui simulamos a detecção de rosto dominante
  // A arquitetura já está pronta para IA real depois

  const faceTimeline = [];

  speakerTimeline.forEach(segment => {
    const segmentDuration = segment.end - segment.start;
    const frames = Math.max(1, Math.floor(segmentDuration * fps));

    for (let i = 0; i < frames; i++) {
      const t =
        segment.start +
        (i / frames) * segmentDuration;

      faceTimeline.push({
        time: Number(t.toFixed(2)),
        faceBox: {
          x: 0.25,   // centro da imagem
          y: 0.15,
          w: 0.5,
          h: 0.7
        },
        confidence: 0.9,
        faceId: "face_1"
      });
    }
  });

  return {
    faceTimeline,
    dominantFaceId: "face_1"
  };
};
