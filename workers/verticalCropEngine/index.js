// workers/verticalCropEngine/index.js

const TranscriptWindowResolver = require("./resolvers/TranscriptWindowResolver");

const SpeakerTimelineAnalyzer = require("./analyzers/SpeakerTimelineAnalyzer");
const FaceDominanceAnalyzer = require("./analyzers/FaceDominanceAnalyzer");
const MotionEnergyAnalyzer = require("./analyzers/MotionEnergyAnalyzer");
const VisualFocusRanker = require("./analyzers/VisualFocusRanker");

const CropPathWalker = require("./analyzers//CropPathWalker");
const ZoomCurveWalker = require("./analyzers//ZoomCurveWalker");

const VerticalRenderWorker = require("./analyzers//VerticalRenderWorker");

module.exports = async function VerticalCropEngine({
  clipPath,
  clipStart,
  clipEnd,
  transcriptSegments,
  clipIndex,
  jobId,
  jobDir
}) {
  console.log(`🎥 [VerticalCropEngine] Clip ${clipIndex} iniciado`);

const result = await VerticalCropEngine({
  clipPath: inputClipPath,
  outputPath: outputClipPath,

  // 👇 mock de janela do clipe
  clipStart: 0,
  clipEnd: 40,

  transcriptSegments
});

  // ===============================
  // 1️⃣ Resolver transcript do clip
  // ===============================
  const { clipTranscriptSegments } = TranscriptWindowResolver({
    clipStart,
    clipEnd,
    transcriptSegments
  });

  // ===============================
  // 2️⃣ Linha do tempo de fala
  // ===============================
  const speakerTimeline = SpeakerTimelineAnalyzer({
    transcriptSegments: clipTranscriptSegments,
    clipDuration: clipEnd - clipStart
  });

  // ===============================
  // 3️⃣ Dominância facial
  // ===============================
  const faceDominanceTimeline = await FaceDominanceAnalyzer({
    clipPath,
    speakerTimeline
  });

  // ===============================
  // 4️⃣ Energia de movimento
  // ===============================
  const motionEnergyTimeline = await MotionEnergyAnalyzer({
    clipPath
  });

  // ===============================
  // 5️⃣ Rankear foco visual
  // ===============================
  const visualFocusTimeline = VisualFocusRanker({
    speakerTimeline,
    faceDominanceTimeline,
    motionEnergyTimeline
  });

  // ===============================
  // 6️⃣ Caminho de crop (x, y, w, h)
  // ===============================
  const cropPath = CropPathWalker({
    visualFocusTimeline,
    clipDuration: clipEnd - clipStart
  });

  // ===============================
  // 7️⃣ Curva de zoom (cinematográfico)
  // ===============================
  const zoomCurve = ZoomCurveWalker({
    speakerTimeline,
    motionEnergyTimeline
  });

  // ===============================
  // 8️⃣ Render vertical final
  // ===============================
  const verticalClipPath = await VerticalRenderWorker({
    clipPath,
    cropPath,
    zoomCurve,
    clipIndex,
    jobId,
    jobDir
  });

  console.log(`✅ [VerticalCropEngine] Clip ${clipIndex} finalizado`);

  return {
    verticalClipPath,
    cropMetadata: {
      cropPath,
      zoomCurve,
      speakerTimeline
    }
  };
};
