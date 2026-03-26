const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

module.exports = function VerticalRenderWorker({
  inputPath,
  outputPath,
  crop,
}) {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(inputPath)) {
        return reject(new Error("Input video não existe"));
      }

      // ───────────────────────────────
      // 1. FFPROBE
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

      probe.stdout.on("data", (d) => {
        probeData += d.toString();
      });

      probe.on("error", (err) => {
        return reject(new Error("Erro ao executar ffprobe: " + err.message));
      });

      probe.on("close", () => {
        let videoWidth, videoHeight;

        try {
          const parsed = JSON.parse(probeData);

          if (!parsed.streams || !parsed.streams[0]) {
            throw new Error("Nenhum stream de vídeo encontrado");
          }

          videoWidth = parsed.streams[0].width;
          videoHeight = parsed.streams[0].height;
        } catch (err) {
          return reject(new Error("Erro ao ler ffprobe: " + err.message));
        }

        console.log("📐 Video:", videoWidth, "x", videoHeight);

        // ───────────────────────────────
        // 2. CROP CORRETO (9:16 REAL)
        // ───────────────────────────────

        let targetWidth = Math.floor(videoWidth * 0.4);
        let targetHeight = Math.floor((targetWidth * 16) / 9);

        // ajuste se passar da altura
        if (targetHeight > videoHeight) {
          targetHeight = videoHeight;
          targetWidth = Math.floor((targetHeight * 9) / 16);
        }

        let cropX;

        if (
          crop &&
          typeof crop.x === "number" &&
          typeof crop.width === "number"
        ) {
          cropX = Math.round(crop.x + crop.width / 2 - targetWidth / 2);
        } else {
          cropX = Math.round((videoWidth - targetWidth) / 2);
        }

        // clamp
        cropX = Math.max(0, cropX);
        if (cropX + targetWidth > videoWidth) {
          cropX = videoWidth - targetWidth;
        }

        // centraliza vertical
        const cropY = Math.round((videoHeight - targetHeight) / 2);

        console.log("🎯 Crop FIXED:", {
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

  "-map", "0:v:0",
  "-c:v", "libx264",

  // 🔥 SUPER IMPORTANTE ↓↓↓
  "-preset", "ultrafast",
  "-threads", "1",
  "-max_muxing_queue_size", "1024",

  "-crf", "28",

  "-pix_fmt", "yuv420p",

  "-map", "0:a?",
  "-c:a", "aac",
  "-b:a", "96k",

  "-movflags", "+faststart",

  outputPath,
];

        console.log("🎬 FFmpeg ARGS:", args.join(" "));

        const ffmpeg = spawn("ffmpeg", args);

        ffmpeg.stderr.on("data", (d) => {
          console.error("⚠️ FFmpeg:", d.toString());
        });

        ffmpeg.on("error", (err) => {
          return reject(new Error("Erro ao executar ffmpeg: " + err.message));
        });

        ffmpeg.on("close", (code) => {
          console.log("🎬 FFmpeg terminou com code:", code);

          // 🔥 FIX PRINCIPAL
          if (code !== 0 && code !== null) {
            return reject(
              new Error(`FFmpeg falhou no render vertical (code ${code})`)
            );
          }

          // 🔥 valida output REAL
          if (!fs.existsSync(outputPath)) {
            return reject(new Error("Arquivo final não foi criado"));
          }

          const size = fs.statSync(outputPath).size;

          if (size < 10000) {
            return reject(
              new Error("Arquivo final inválido ou muito pequeno")
            );
          }

          console.log("✅ Render vertical OK:", outputPath);
          console.log("📦 Size:", (size / 1024).toFixed(2), "KB");

          resolve({
            ok: true,
            outputPath,
          });
        });
      });
    } catch (err) {
      reject(err);
    }
  });
};
