const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ensureFileExists(filePath, label = "arquivo") {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`[BurnInWorker] ${label} não encontrado: ${filePath}`);
  }
}

function ensureOutputLooksValid(filePath) {
  ensureFileExists(filePath, "output");

  const stats = fs.statSync(filePath);

  if (!stats.size || stats.size < 50_000) {
    throw new Error(
      `[BurnInWorker] Output inválido ou muito pequeno: ${filePath} (${stats.size} bytes)`
    );
  }

  return stats.size;
}

function escapeAssPath(filePath) {
  return filePath
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

module.exports = function BurnInWorker({
  jobId,
  jobDir,
  clipIndex,
  videoPath,
  assContent,
}) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`🔥 [BurnInWorker] START clip=${clipIndex}`);

      if (!jobDir) {
        throw new Error("[BurnInWorker] jobDir ausente");
      }

      if (!assContent || typeof assContent !== "string") {
        throw new Error("[BurnInWorker] assContent inválido");
      }

      ensureFileExists(videoPath, "videoPath");
      ensureDir(jobDir);

      const assPath = path.join(jobDir, `clip_${clipIndex}.ass`);
      const outputVideoPath = path.join(jobDir, `clip_${clipIndex}_burned.mp4`);

      fs.writeFileSync(assPath, assContent, "utf8");
      console.log(`💾 [BurnInWorker] ASS salvo: ${assPath}`);

      const safeAssPath = escapeAssPath(assPath);

      // 🔥 Mais leve:
      // - preset ultrafast
      // - crf 30
      // - threads 1
      // - scale para 720x1280
      // - áudio mais leve
      const videoFilter = `ass=${safeAssPath},scale=720:1280`;

      const args = [
        "-hide_banner",
        "-loglevel", "error",
        "-y",

        "-i", videoPath,

        "-vf", videoFilter,

        "-map", "0:v:0",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "30",
        "-pix_fmt", "yuv420p",
        "-threads", "1",

        "-map", "0:a?",
        "-c:a", "aac",
        "-b:a", "96k",

        "-movflags", "+faststart",

        outputVideoPath,
      ];

      console.log(`🎬 [BurnInWorker] FFmpeg clip=${clipIndex}`);

      const ffmpeg = spawn("ffmpeg", args, {
        stdio: ["ignore", "ignore", "pipe"],
      });

      let stderrBuffer = "";
      let stderrTail = [];

      ffmpeg.stderr.on("data", (data) => {
        const msg = data.toString();
        stderrBuffer += msg;

        // guarda só as últimas linhas úteis
        stderrTail.push(msg);
        if (stderrTail.length > 20) {
          stderrTail.shift();
        }
      });

      ffmpeg.on("error", (err) => {
        return reject(
          new Error(`[BurnInWorker] Erro ao iniciar FFmpeg: ${err.message}`)
        );
      });

      // timeout hard
      const timeoutMs = 8 * 60 * 1000; // 8 minutos
      const timeout = setTimeout(() => {
        console.error(`⏱️ [BurnInWorker] Timeout clip=${clipIndex}`);
        ffmpeg.kill("SIGKILL");
      }, timeoutMs);

      ffmpeg.on("close", (code, signal) => {
        clearTimeout(timeout);

        console.log(
          `🧪 [BurnInWorker] FFmpeg terminou clip=${clipIndex} code=${code} signal=${signal || "none"}`
        );

        if (signal) {
          return reject(
            new Error(
              `[BurnInWorker] FFmpeg interrompido no clip ${clipIndex} por signal=${signal}\n${stderrTail.join("")}`
            )
          );
        }

        if (code !== 0) {
          return reject(
            new Error(
              `[BurnInWorker] FFmpeg falhou no clip ${clipIndex} (code=${code})\n${stderrTail.join("")}`
            )
          );
        }

        try {
          const size = ensureOutputLooksValid(outputVideoPath);

          console.log(
            `✅ [BurnInWorker] clip=${clipIndex} concluído (${(size / 1024 / 1024).toFixed(2)} MB)`
          );

          resolve({
            jobId,
            clipIndex,
            inputVideoPath: videoPath,
            assPath,
            outputVideoPath,
            status: "burned",
          });
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
};
