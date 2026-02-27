// sources/normalizeVideo.js
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function normalizeVideo(inputPath, jobId) {
  if (!inputPath) {
    throw new Error("normalizeVideo: inputPath ausente");
  }

  console.log("🎚 Normalizando vídeo...");

  const baseDir = path.join(
    process.cwd(),
    "processed",
    jobId
  );

  ensureDir(baseDir);

  const outputPath = path.join(baseDir, "normalized.mp4");

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-preset fast",
        "-movflags +faststart",
        "-profile:v main",
        "-level 4.1",
        "-pix_fmt yuv420p",
        "-vf scale=1080:-2",
        "-r 30",
        "-af loudnorm"
      ])
      .on("start", () => {
        console.log("▶️ FFmpeg iniciou");
      })
      .on("end", () => {
        console.log("✅ Normalização concluída:", outputPath);
        resolve({
          normalizedVideoPath: outputPath
        });
      })
      .on("error", (err) => {
        reject(err);
      })
      .save(outputPath);
  });
}

module.exports = normalizeVideo;
