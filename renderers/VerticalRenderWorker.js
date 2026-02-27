const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

module.exports = async function VerticalRenderWorker({
  inputPath,
  outputPath,
  segments,
}) {
  return new Promise((resolve, reject) => {
    if (!inputPath || !outputPath || !segments?.length) {
      return reject(new Error("Parâmetros inválidos no VerticalRenderWorker"));
    }

    // usamos só o PRIMEIRO segmento (crop simples e estável)
    const seg = segments[0];

    const {
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      start,
      end,
    } = seg;

    const duration = Math.max(0.1, end - start);

    // filtro de vídeo: crop 9:16 + zoom LEVE
    const vf = `
      crop=${cropWidth}:${cropHeight}:${cropX}:${cropY},
      scale=1080:1920,
      zoompan=z='min(1.05,1+0.0005*n)':d=1
    `.replace(/\s+/g, "");

    const args = [
      "-y",
      "-ss", String(start),
      "-i", inputPath,
      "-t", String(duration),

      // vídeo
      "-vf", vf,
      "-map", "0:v:0",

      // áudio (muito importante)
      "-map", "0:a:0",
      "-c:a", "aac",
      "-b:a", "128k",

      // codecs seguros
      "-c:v", "libx264",
      "-profile:v", "high",
      "-pix_fmt", "yuv420p",

      // QuickTime SAFE
      "-movflags", "+faststart",

      outputPath,
    ];

    const ff = spawn("ffmpeg", args);

    ff.stderr.on("data", () => {}); // silêncio (menos ruído)

    ff.on("error", reject);

    ff.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error("FFmpeg falhou no VerticalRenderWorker"));
      }

      // validação final
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1000) {
        return reject(new Error("MP4 inválido gerado"));
      }

      resolve(true);
    });
  });
};
