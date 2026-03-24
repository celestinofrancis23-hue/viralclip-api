const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
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

    probe.on("close", () => {
      let videoWidth, videoHeight;

      try {
        const parsed = JSON.parse(probeData);
        videoWidth = parsed.streams[0].width;
        videoHeight = parsed.streams[0].height;
      } catch {
        return reject(new Error("Erro ao ler ffprobe"));
      }

      console.log("📐 Video:", videoWidth, "x", videoHeight);

      // ───────────────────────────────
      // 2. CROP SEGURO (COM FALLBACK)
      // ───────────────────────────────

      const targetHeight = videoHeight;
      let targetWidth = Math.round((targetHeight * 9) / 16);

      if (targetWidth > videoWidth) {
        targetWidth = videoWidth;
      }

      let cropX;

      if (
        crop &&
        typeof crop.x === "number" &&
        typeof crop.width === "number"
      ) {
        cropX = Math.round(crop.x + crop.width / 2 - targetWidth / 2);
      } else {
        // 🔥 FALLBACK: centro do vídeo
        cropX = Math.round((videoWidth - targetWidth) / 2);
      }

      // Clamp (garantir dentro do vídeo)
      if (cropX < 0) cropX = 0;
      if (cropX + targetWidth > videoWidth) {
        cropX = videoWidth - targetWidth;
      }

      const cropY = 0;

      console.log("🎯 Crop final:", {
        width: targetWidth,
        height: targetHeight,
        x: cropX,
        y: cropY,
      });

      const filter = `crop=${targetWidth}:${targetHeight}:${cropX}:${cropY},scale=1080:1920`;

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });

      // ───────────────────────────────
      // 3. FFMPEG
      // ───────────────────────────────

      const args = [
        "-y",
        "-i",
        inputPath,

        "-vf",
        filter,

        "-map",
        "0:v:0",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",

        "-map",
        "0:a?",
        "-c:a",
        "aac",
        "-b:a",
        "128k",

        "-movflags",
        "+faststart",

        outputPath,
      ];

      console.log("🎬 FFmpeg ARGS:", args.join(" "));

      const ffmpeg = spawn("ffmpeg", args);

      ffmpeg.stderr.on("data", (d) => {
        console.error("⚠️ FFmpeg:", d.toString());
      });

      ffmpeg.on("close", (code) => {
        if (code !== 0) {
          return reject(
            new Error(`FFmpeg falhou no render vertical (code ${code})`)
          );
        }

        console.log("✅ Render vertical OK:", outputPath);

        resolve({
          ok: true,
          outputPath,
        });
      });
    });
  });
};
