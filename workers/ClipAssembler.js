const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// 🔒 GLOBAL LOCK (evita concorrência acidental)
let isProcessing = false;

function safeMkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[ClipAssembler] Arquivo não encontrado: ${filePath}`);
  }
}

function ensureClipLooksValid(filePath) {
  ensureFileExists(filePath);

  const stats = fs.statSync(filePath);

  if (!stats.size || stats.size < 50_000) {
    throw new Error(
      `[ClipAssembler] Clip inválido: ${filePath} (${stats.size} bytes)`
    );
  }

  return stats.size;
}

function sanitizeTime(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  return n;
}

// 🔥 FFmpeg EXECUTOR (ULTRA CONTROLADO)
function cutClip({ videoPath, clipPath, start, duration, clipIndex }) {
  return new Promise((resolve, reject) => {
    const args = [
      "-hide_banner",
      "-loglevel", "error",
      "-y",

      "-ss", start.toFixed(3),
      "-i", videoPath,
      "-t", duration.toFixed(3),

      "-map", "0:v:0?",
      "-map", "0:a:0?",

      "-c:v", "libx264",
      "-preset", "ultrafast",   // 🔥 REDUZ CPU
      "-crf", "28",             // 🔥 REDUZ PESO CPU
      "-pix_fmt", "yuv420p",

      "-c:a", "aac",
      "-b:a", "96k",

      "-movflags", "+faststart",
      "-threads", "1",          // 🔥 CRÍTICO

      clipPath
    ];

    console.log(`🎞️ Clip ${clipIndex} → FFmpeg start`);

    const ffmpeg = spawn("ffmpeg", args);

    let stderr = "";

    ffmpeg.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    ffmpeg.on("error", (err) => {
      reject(new Error(`[ClipAssembler] FFmpeg error: ${err.message}`));
    });

    ffmpeg.on("close", (code, signal) => {
      if (signal) {
        return reject(
          new Error(`[ClipAssembler] FFmpeg killed (signal=${signal})`)
        );
      }

      if (code !== 0) {
        return reject(
          new Error(`[ClipAssembler] FFmpeg failed (code=${code})\n${stderr}`)
        );
      }

      try {
        const size = ensureClipLooksValid(clipPath);

        console.log(
          `✅ Clip ${clipIndex} OK (${(size / 1024 / 1024).toFixed(2)} MB)`
        );

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

// ===============================
// MAIN
// ===============================
module.exports = async function ClipAssembler({
  videoPath,
  viralMoments,
  jobId,
  jobDir,
}) {
  if (isProcessing) {
    throw new Error("⚠️ Já existe um processamento ativo (proteção contra overload)");
  }

  isProcessing = true;

  try {
    if (!videoPath || !fs.existsSync(videoPath)) {
      throw new Error("[ClipAssembler] Vídeo não encontrado");
    }

    if (!Array.isArray(viralMoments) || viralMoments.length === 0) {
      throw new Error("[ClipAssembler] viralMoments inválido");
    }

    if (!jobDir) {
      throw new Error("[ClipAssembler] jobDir obrigatório");
    }

    const clipsDir = path.join(jobDir, "clips");
    safeMkdir(clipsDir);

    console.log("🎬 Iniciando ClipAssembler...");
    console.log("🎯 Clips recebidos:", viralMoments.length);

    const clips = [];

    // 🔥 SEQUENCIAL GARANTIDO
    for (const [i, moment] of viralMoments.entries()) {
      const start = sanitizeTime(moment.startTime ?? moment.start);
      const end = sanitizeTime(moment.endTime ?? moment.end);
      const clipIndex = Number.isFinite(Number(moment.clipIndex))
        ? Number(moment.clipIndex)
        : i;

      if (start === null || end === null || end <= start) {
        console.warn(`⚠️ Clip ${clipIndex} ignorado`);
        continue;
      }

      const duration = end - start;

      if (duration < 1) {
        console.warn(`⚠️ Clip ${clipIndex} muito curto (${duration}s)`);
        continue;
      }

      const clipPath = path.join(clipsDir, `clip_${clipIndex}.mp4`);

      console.log(
        `✂️ Clip ${clipIndex}: ${start.toFixed(2)} → ${end.toFixed(2)}`
      );

      // 🔥 EXECUTA UM POR VEZ
      await cutClip({
        videoPath,
        clipPath,
        start,
        duration,
        clipIndex,
      });

      clips.push({
        clipIndex,
        clipPath,
        startTime: start,
        endTime: end,
        duration,
      });
    }

    if (clips.length === 0) {
      throw new Error("Nenhum clip válido gerado");
    }

    console.log("🔥 TOTAL CLIPS:", clips.length);

    return {
      clips,
      clipsDir,
    };

  } catch (err) {
    console.error("❌ ClipAssembler ERROR:", err.message);
    throw err;
  } finally {
    isProcessing = false; // 🔓 libera lock
  }
};
