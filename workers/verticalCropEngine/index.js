// workers/verticalCropEngine/index.js
//
// Orquestrador do pipeline de crop vertical.
// Fluxo:
//   transcript → speaker timeline → face detection → motion energy
//   → visual focus → crop path (suavizado) → zoom curve → render dinâmico

const { spawnSync } = require("child_process");

const TranscriptWindowResolver = require("./resolvers/TranscriptWindowResolver");
const SpeakerTimelineAnalyzer  = require("./analyzers/SpeakerTimelineAnalyzer");
const FaceDominanceAnalyzer    = require("./analyzers/FaceDominanceAnalyzer");
const MotionEnergyAnalyzer     = require("./analyzers/MotionEnergyAnalyzer");
const VisualFocusRanker        = require("./analyzers/VisualFocusRanker");
const CropPathWalker           = require("./analyzers/CropPathWalker");
const ZoomCurveWalker          = require("./analyzers/ZoomCurveWalker");
const VerticalRenderWorker     = require("./analyzers/VerticalRenderWorker");

module.exports = async function VerticalCropEngine({
  clipPath,
  clipStart,
  clipEnd,
  transcriptSegments = [],
  outputPath,
  clipIndex = 0,
  jobId,
  jobDir
}) {
  console.log(`🎥 [VerticalCropEngine] Clip ${clipIndex} iniciado`);

  // Defaults: se não fornecidos, probar duração do vídeo
  if (clipStart == null) clipStart = 0;
  if (clipEnd   == null) clipEnd   = getVideoDuration(clipPath) || 30;

  const clipDuration = clipEnd - clipStart;

  // ── 1. Resolver transcript do clip ──────────────────────────────────────
  const { clipTranscriptSegments } = TranscriptWindowResolver({
    clipStart,
    clipEnd,
    transcriptSegments
  });

  // ── 2. Linha do tempo de fala ────────────────────────────────────────────
  const { speakerTimeline } = SpeakerTimelineAnalyzer({
    clipTranscriptSegments,
    clipDuration
  });

  // ── 3. Detecção de rosto dominante (real, via MediaPipe) ─────────────────
  const {
    faceTimeline,
    videoWidth,
    videoHeight
  } = await FaceDominanceAnalyzer({
    videoPath: clipPath,
    clipDuration,
    speakerTimeline
  });

  // ── 4. Energia de movimento ───────────────────────────────────────────────
  const { motionTimeline } = await MotionEnergyAnalyzer({
    videoPath: clipPath,
    clipDuration
  });

  // ── 5. Rankear foco visual ────────────────────────────────────────────────
  const { visualFocusTimeline } = VisualFocusRanker({
    speakerTimeline,
    faceTimeline,
    motionTimeline
  });

  // ── 6. Caminho de crop com tracking suavizado (EMA + SMA + dead zone) ────
  const { cropPath } = CropPathWalker({
    faceTimeline,           // tracking de rosto frame a frame
    clipDuration,
    sourceWidth:  videoWidth,
    sourceHeight: videoHeight
  });

  // ── 7. Curva de zoom cinematográfico ─────────────────────────────────────
  const { zoomPath } = ZoomCurveWalker({
    cropPath,
    visualFocusTimeline,
    clipDuration
  });

  // ── 8. Render vertical dinâmico ───────────────────────────────────────────
  const verticalClipPath = outputPath || clipPath.replace(/\.mp4$/i, "_vertical.mp4");

  await VerticalRenderWorker({
    inputVideoPath:  clipPath,
    outputVideoPath: verticalClipPath,
    cropPath,
    zoomPath
  });

  console.log(`✅ [VerticalCropEngine] Clip ${clipIndex} finalizado → ${verticalClipPath}`);

  return {
    verticalClipPath,
    cropMetadata: {
      cropPath,
      zoomPath,
      speakerTimeline,
      faceTimeline
    }
  };
};

// ─────────────────────────────────────────────────────────────────────────────

function getVideoDuration(videoPath) {
  try {
    const result = spawnSync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      videoPath
    ]);

    if (result.error || result.status !== 0) return null;

    const dur = parseFloat(result.stdout.toString().trim());
    return isNaN(dur) ? null : dur;
  } catch {
    return null;
  }
}
