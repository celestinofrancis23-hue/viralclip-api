// workers/verticalCropEngine/analyzers/MotionEnergyAnalyzer.js
//
// Calcula energia de movimento entre frames consecutivos.
// Usa diferença de bytes JPEG (rápido, suficiente para detectar movimento).

const { spawn } = require("child_process");
const fs        = require("fs");
const path      = require("path");
const crypto    = require("crypto");

const ANALYSIS_FPS = 5;

module.exports = async function MotionEnergyAnalyzer({
  videoPath,
  clipDuration,
  fps = ANALYSIS_FPS
}) {
  if (!videoPath) {
    throw new Error("[MotionEnergyAnalyzer] videoPath é obrigatório");
  }

  const tmpDir = path.join(
    path.dirname(videoPath),
    `.motion_${crypto.randomUUID()}`
  );
  fs.mkdirSync(tmpDir, { recursive: true });

  const framePattern = path.join(tmpDir, "frame_%04d.jpg");

  try {
    // ── 1. Extrair frames ────────────────────────────────────────────────
    await extractFrames(videoPath, tmpDir, fps);

    // ── 2. Calcular diferença entre frames consecutivos ──────────────────
    const frames = fs
      .readdirSync(tmpDir)
      .filter(f => f.endsWith(".jpg"))
      .sort();

    const motionTimeline = [];
    let lastBuffer = null;

    for (let i = 0; i < frames.length; i++) {
      const framePath = path.join(tmpDir, frames[i]);
      const buffer    = fs.readFileSync(framePath);

      let energy = 0;

      if (lastBuffer) {
        const len = Math.min(buffer.length, lastBuffer.length);
        let diff  = 0;

        // amostragem a cada 50 bytes — rápido e representativo
        for (let j = 0; j < len; j += 50) {
          diff += Math.abs(buffer[j] - lastBuffer[j]);
        }

        energy = diff / (len / 50);
      }

      motionTimeline.push({
        time:   Number((i / fps).toFixed(3)),
        energy: Number(energy.toFixed(2))
      });

      lastBuffer = buffer;
    }

    // ── 3. Estatísticas ──────────────────────────────────────────────────
    const energies     = motionTimeline.map(m => m.energy);
    const totalFrames  = energies.length || 1;
    const averageEnergy = energies.reduce((a, b) => a + b, 0) / totalFrames;
    const peakEnergy    = Math.max(...energies, 0);

    return {
      motionTimeline,
      averageEnergy: Number(averageEnergy.toFixed(2)),
      peakEnergy:    Number(peakEnergy.toFixed(2))
    };

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

function extractFrames(videoPath, tmpDir, fps) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i", videoPath,
      "-vf", `fps=${fps}`,
      "-q:v", "5",
      path.join(tmpDir, "frame_%04d.jpg")
    ];

    const proc = spawn("ffmpeg", args);
    proc.on("error", reject);
    proc.on("close", code => {
      if (code !== 0) {
        return reject(new Error("[MotionEnergyAnalyzer] FFmpeg falhou na extracção de frames"));
      }
      resolve();
    });
  });
}
