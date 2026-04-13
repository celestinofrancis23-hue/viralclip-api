// workers/verticalCropEngine/analyzers/FaceDominanceAnalyzer.js
//
// Identifica o rosto dominante ao longo do tempo usando detecção real (MediaPipe).
// Estratégia: o rosto dominante é o maior (área) com confidence ≥ threshold.
// Retorna faceTimeline com bbox normalizada e centros suavizados por EMA.

const FaceDetectionWorker = require("./FaceDetectionWorker");

const CONFIDENCE_MIN  = 0.4;
const EMA_ALPHA       = 0.3;  // suavização EMA — menor = mais suave (mais lag)

module.exports = async function FaceDominanceAnalyzer({
  videoPath,
  clipDuration,
  speakerTimeline,
  fps = 3
}) {
  if (!videoPath) {
    throw new Error("[FaceDominanceAnalyzer] videoPath é obrigatório");
  }

  // ─── 1. Detecção real de rostos frame a frame ─────────────────────────────
  let faceTimeline = [];
  let videoWidth   = 1920;
  let videoHeight  = 1080;

  try {
    const result = await FaceDetectionWorker({ videoPath, clipDuration });
    faceTimeline = result.faceTimeline;
    videoWidth   = result.videoWidth;
    videoHeight  = result.videoHeight;
  } catch (err) {
    console.warn("[FaceDominanceAnalyzer] detecção falhou, usando fallback central:", err.message);
    // fallback: centro da imagem durante toda a duração
    return buildFallback(clipDuration, fps);
  }

  // ─── 2. Seleccionar rosto dominante por frame (maior área + confidence) ───
  const dominantPerFrame = faceTimeline.map(({ time, faces }) => {
    if (!faces.length) return { time, face: null };

    const valid = faces.filter(f => f.confidence >= CONFIDENCE_MIN);
    if (!valid.length) return { time, face: null };

    // rosto com maior área
    const dominant = valid.reduce((best, f) =>
      f.area > best.area ? f : best
    );

    return { time, face: dominant };
  });

  // ─── 3. Preencher frames sem rosto (interpolação do último conhecido) ─────
  let lastFace = null;
  const filled = dominantPerFrame.map(({ time, face }) => {
    if (face) {
      lastFace = face;
      return { time, face };
    }
    // usa última posição conhecida (câmera não salta)
    return { time, face: lastFace };
  });

  // ─── 4. Aplicar EMA nos centros para movimento suave ─────────────────────
  let emaX = null;
  let emaY = null;

  const smoothed = filled.map(({ time, face }) => {
    if (!face) {
      return {
        time,
        faceBox: null,
        center: { x: 0.5, y: 0.3 } // posição neutra
      };
    }

    const rawX = face.centerX;
    const rawY = face.centerY;

    if (emaX === null) {
      emaX = rawX;
      emaY = rawY;
    } else {
      emaX = EMA_ALPHA * rawX + (1 - EMA_ALPHA) * emaX;
      emaY = EMA_ALPHA * rawY + (1 - EMA_ALPHA) * emaY;
    }

    return {
      time,
      faceBox: {
        x: face.x,
        y: face.y,
        w: face.w,
        h: face.h
      },
      center: {
        x: round4(emaX),
        y: round4(emaY)
      },
      confidence: face.confidence
    };
  });

  return {
    faceTimeline: smoothed,
    dominantFaceId: "face_dominant",
    videoWidth,
    videoHeight
  };
};

// ─────────────────────────────────────────────────────────────────────────────

function buildFallback(clipDuration, fps) {
  const frames = Math.max(1, Math.ceil((clipDuration || 30) * fps));
  const faceTimeline = [];

  for (let i = 0; i < frames; i++) {
    faceTimeline.push({
      time: round4(i / fps),
      faceBox: null,
      center: { x: 0.5, y: 0.3 }
    });
  }

  return { faceTimeline, dominantFaceId: null, videoWidth: 1920, videoHeight: 1080 };
}

function round4(v) {
  return Math.round(v * 10000) / 10000;
}
