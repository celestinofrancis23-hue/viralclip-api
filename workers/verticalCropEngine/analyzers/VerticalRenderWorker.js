// workers/verticalCropEngine/render/VerticalRenderWorker.js

const { spawn } = require("child_process");
const path = require("path");

module.exports = function VerticalRenderWorker({
  inputVideoPath,
  outputVideoPath,
  cropPath,
  zoomPath,
  targetWidth = 1080,
  targetHeight = 1920,
  fps = 30
}) {
  return new Promise((resolve, reject) => {
    if (!inputVideoPath || !outputVideoPath) {
      return reject(
        new Error("[VerticalRenderWorker] input ou output inválido")
      );
    }

    if (!Array.isArray(cropPath) || !Array.isArray(zoomPath)) {
      return reject(
        new Error("[VerticalRenderWorker] cropPath ou zoomPath inválido")
      );
    }

    console.log("🎬 VerticalRender iniciado");
    console.log("📥 Input:", inputVideoPath);
    console.log("📤 Output:", outputVideoPath);

    const filter = buildFilter(cropPath, zoomPath, targetWidth, targetHeight);

    const args = [
      "-y",
      "-i", inputVideoPath,
      "-vf", filter,
      "-r", String(fps),
      "-c:v", "libx264",
      "-preset", "fast",
      "-pix_fmt", "yuv420p",
      outputVideoPath
    ];

    const ffmpeg = spawn("ffmpeg", args);

    ffmpeg.stderr.on("data", (data) => {
      process.stdout.write(data.toString());
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error("[VerticalRenderWorker] ffmpeg falhou")
        );
      }

      console.log("✅ VerticalRender finalizado");
      resolve({ outputVideoPath });
    });
  });
};

/* ========================================================= */

function buildFilter(cropPath, zoomPath, targetW, targetH) {
  // MVP simples: usa primeiro crop + zoom médio
  const firstCrop = cropPath[0]?.crop;
  const avgZoom =
    zoomPath.reduce((s, z) => s + z.zoom, 0) / zoomPath.length || 1;

  if (!firstCrop) {
    throw new Error("[VerticalRenderWorker] cropPath vazio");
  }

  const cropExpr = `crop=${firstCrop.width}:${firstCrop.height}:${firstCrop.x}:${firstCrop.y}`;
  const scaleExpr = `scale=${Math.round(targetW * avgZoom)}:${Math.round(targetH * avgZoom)}`;
  const finalScale = `scale=${targetW}:${targetH}`;

  return [
    cropExpr,
    scaleExpr,
    finalScale
  ].join(",");
}
