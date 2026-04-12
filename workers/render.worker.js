const { execFile } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const fs   = require("fs");

const execFileAsync = promisify(execFile);

async function RenderWorker({ clip, assPath, jobDir }) {
  const outputPath = path.join(jobDir, `captioned_${clip.clipIndex}.mp4`);
  const escapedAssPath = escapeAssPath(assPath);

  const args = [
    "-y",
    "-i", clip.videoPath,
    "-vf", `ass=${escapedAssPath}`,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "20",
    "-c:a", "copy",
    "-movflags", "+faststart",
    "-pix_fmt", "yuv420p",
    outputPath,
  ];

  console.log(`      🎨 Renderizando legenda no clipe ${clip.clipIndex}...`);

  try {
    await execFileAsync("ffmpeg", args, { timeout: 300000 });
  } catch (error) {
    throw new Error(`RenderWorker falhou no clipe ${clip.clipIndex}: ${error.message}`);
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error(`RenderWorker: arquivo de saída não foi criado: ${outputPath}`);
  }

  const stats = fs.statSync(outputPath);
  console.log(`      ✅ Legenda queimada — ${(stats.size / 1024 / 1024).toFixed(1)}MB`);

  return { outputPath };
}

function escapeAssPath(filePath) {
  return filePath
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/ /g, "\\ ");
}

module.exports = { RenderWorker };

