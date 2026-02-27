const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

module.exports = async function MotionEnergyAnalyzer({
  videoPath,
  clipDuration,
  fps = 5,
}) {
  if (!videoPath) {
    throw new Error("MotionEnergyAnalyzer: videoPath is required");
  }

  const tmpDir = path.join(
    path.dirname(videoPath),
    `.motion_${crypto.randomUUID()}`
  );
  fs.mkdirSync(tmpDir, { recursive: true });

  const framePattern = path.join(tmpDir, "frame_%04d.jpg");

  // 1️⃣ Extrair frames
  await new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        `-vf fps=${fps}`,
        "-q:v 5",
      ])
      .output(framePattern)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

  // 2️⃣ Calcular diferença entre frames
  const frames = fs
    .readdirSync(tmpDir)
    .filter(f => f.endsWith(".jpg"))
    .sort();

  let motionTimeline = [];
  let lastFrameBuffer = null;

  for (let i = 0; i < frames.length; i++) {
    const framePath = path.join(tmpDir, frames[i]);
    const buffer = fs.readFileSync(framePath);

    let energy = 0;

    if (lastFrameBuffer) {
      // diferença simples de bytes (rápido e suficiente)
      const len = Math.min(buffer.length, lastFrameBuffer.length);
      let diff = 0;

      for (let j = 0; j < len; j += 50) {
        diff += Math.abs(buffer[j] - lastFrameBuffer[j]);
      }

      energy = diff / (len / 50);
    }

    motionTimeline.push({
      time: Number(((i / fps)).toFixed(2)),
      energy: Number(energy.toFixed(2)),
    });

    lastFrameBuffer = buffer;
  }

  // 3️⃣ Estatísticas
  const energies = motionTimeline.map(m => m.energy);
  const averageEnergy =
    energies.reduce((a, b) => a + b, 0) / (energies.length || 1);
  const peakEnergy = Math.max(...energies, 0);

  // cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return {
    motionTimeline,
    averageEnergy: Number(averageEnergy.toFixed(2)),
    peakEnergy: Number(peakEnergy.toFixed(2)),
  };
};
