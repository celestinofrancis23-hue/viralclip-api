// workers/verticalCropEngine/analyzers/FaceDetectionWorker.js
//
// Extrai frames do vídeo com FFmpeg e detecta rostos via MediaPipe (Python).
// Retorna faceTimeline: [{time, faces:[{x,y,w,h,confidence}]}]
// Coordenadas normalizadas [0-1].

const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const PYTHON_BIN = path.join(__dirname, "../../../.venv/bin/python3");
const DETECT_SCRIPT = path.join(__dirname, "../../../scripts/detect_faces.py");
const DETECTION_FPS = 3; // frames por segundo extraídos para análise

module.exports = async function FaceDetectionWorker({ videoPath, clipDuration }) {
  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error(`[FaceDetectionWorker] videoPath inválido: ${videoPath}`);
  }

  // ─── 1. Obter dimensões do vídeo ───────────────────────────────────────────
  const { width, height } = getVideoDimensions(videoPath);

  // ─── 2. Criar directório temporário para frames ───────────────────────────
  const tmpDir = path.join(
    path.dirname(videoPath),
    `.faces_${crypto.randomUUID()}`
  );
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // ─── 3. Extrair frames com FFmpeg ────────────────────────────────────────
    await extractFrames(videoPath, tmpDir, DETECTION_FPS);

    // ─── 4. Correr detecção Python + MediaPipe ───────────────────────────────
    const rawDetections = await runPythonDetector(
      tmpDir,
      DETECTION_FPS,
      width,
      height
    );

    // ─── 5. Normalizar para faceTimeline ─────────────────────────────────────
    const faceTimeline = rawDetections.map(({ time, faces }) => ({
      time,
      faces: faces.map(f => ({
        // centro normalizado do rosto
        centerX: f.x + f.w / 2,
        centerY: f.y + f.h / 2,
        // bbox normalizada
        x: f.x,
        y: f.y,
        w: f.w,
        h: f.h,
        area: f.w * f.h,
        confidence: f.confidence
      }))
    }));

    return { faceTimeline, videoWidth: width, videoHeight: height };

  } finally {
    // ─── Limpeza ──────────────────────────────────────────────────────────────
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

function getVideoDimensions(videoPath) {
  const result = spawnSync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=s=x:p=0",
    videoPath
  ]);

  if (result.error || result.status !== 0) {
    return { width: 1920, height: 1080 }; // fallback seguro
  }

  const [w, h] = result.stdout.toString().trim().split("x").map(Number);
  return {
    width:  w || 1920,
    height: h || 1080
  };
}

function extractFrames(videoPath, tmpDir, fps) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i", videoPath,
      "-vf", `fps=${fps}`,
      "-q:v", "3",
      path.join(tmpDir, "frame_%04d.jpg")
    ];

    const proc = spawn("ffmpeg", args);
    proc.on("error", reject);
    proc.on("close", code => {
      if (code !== 0) return reject(new Error("[FaceDetectionWorker] FFmpeg frame extraction falhou"));
      resolve();
    });
  });
}

function runPythonDetector(framesDir, fps, width, height) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [
      DETECT_SCRIPT,
      framesDir,
      String(fps),
      String(width),
      String(height)
    ]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", d => { stdout += d.toString(); });
    proc.stderr.on("data", d => { stderr += d.toString(); });

    proc.on("error", reject);

    proc.on("close", code => {
      if (code !== 0) {
        console.error("[FaceDetectionWorker] Python stderr:", stderr.slice(0, 500));
        return reject(new Error("[FaceDetectionWorker] Python detector falhou"));
      }

      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch (e) {
        reject(new Error("[FaceDetectionWorker] JSON inválido do detector"));
      }
    });
  });
}
