const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

module.exports = function VerticalRenderWorker({
  inputPath,
  outputPath,
  crop,
}) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error("Input video não existe"));
    }

    // ───────────────────────────────
    // 1. FFPROBE – resolução REAL
    // ───────────────────────────────
    const probe = spawn("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      inputPath,
    ]);

    let probeData = "";

    probe.stdout.on("data", (d) => (probeData += d.toString()));
    probe.stderr.on("data", () => {});

    probe.on("close", () => {
      let videoWidth, videoHeight;

      try {
        const parsed = JSON.parse(probeData);
        videoWidth = parsed.streams[0].width;
        videoHeight = parsed.streams[0].height;
      } catch {
        return reject(new Error("Erro ao ler ffprobe"));
      }

      // ───────────────────────────────
      // 2. CROP SEGURO 9:16
      // ───────────────────────────────
      const targetHeight = videoHeight;
      let targetWidth = Math.round((targetHeight * 9) / 16);

      if (targetWidth > videoWidth) {
        targetWidth = videoWidth;
      }

      let cropX =
        Math.round(crop.x + crop.width / 2 - targetWidth / 2);

      if (cropX < 0) cropX = 0;
      if (cropX + targetWidth > videoWidth) {
        cropX = videoWidth - targetWidth;
      }

      const cropY = 0;

      const filter = `
crop=${targetWidth}:${targetHeight}:${cropX}:${cropY},
scale=1080:1920
      `.trim();

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });

      // ───────────────────────────────
      // 3. FFMPEG – COM ÁUDIO
      // ───────────────────────────────
      const ffmpeg = spawn("ffmpeg", [
        "-y",
        "-i",
        inputPath,

        // vídeo
        "-vf",
        filter,
        "-map",
        "0:v:0",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-profile:v",
        "high",
        "-pix_fmt",
        "yuv420p",

        // áudio (AQUI ESTÁ A CORREÇÃO 🔊)
        "-map",
        "0:a?",
        "-c:a",
        "aac",
        "-b:a",
        "128k",

        "-movflags",
        "+faststart",
        outputPath,
      ]);

      ffmpeg.stderr.on("data", () => {}); // console limpo

      ffmpeg.on("close", (code) => {
        if (code !== 0) {
          return reject(new Error("FFmpeg falhou no render vertical"));
        }

        resolve({
          ok: true,
          outputPath,
        });
      });
    });
  });
};
