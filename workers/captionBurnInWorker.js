/**
 * CaptionBurnInWorker (ASS)
 * Burn-in definitivo usando FFmpeg subtitles
 * CommonJS | Produção | Estável
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

module.exports = function CaptionBurnInWorker({
  videoPath,
  assPath,
  outputPath
}) {
  // ============================
  // 1. Validações
  // ============================
  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error("[BurnIn] videoPath inválido ou inexistente");
  }

  if (!assPath || !fs.existsSync(assPath)) {
    throw new Error("[BurnIn] assPath inválido ou inexistente");
  }

  if (!outputPath) {
    throw new Error("[BurnIn] outputPath não informado");
  }

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // ============================
  // 2. FFmpeg subtitles
  // ============================
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i", videoPath,
      "-vf", `subtitles=${assPath}`,
      "-c:a", "copy",
      outputPath
    ];

    const ffmpeg = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"]
    });

    ffmpeg.stderr.on("data", () => {
      // silencioso
    });

    ffmpeg.on("error", err => {
      reject(new Error("[BurnIn] Erro ao iniciar FFmpeg"));
    });

    ffmpeg.on("close", code => {
      if (code !== 0) {
        return reject(
          new Error(`[BurnIn] FFmpeg finalizou com erro (${code})`)
        );
      }

      console.log("✅ Burn-in aplicado:", outputPath);

      resolve({
        success: true,
        outputPath
      });
    });
  });
};
