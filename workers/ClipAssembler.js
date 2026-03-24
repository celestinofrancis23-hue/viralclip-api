const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

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
      `[ClipAssembler] Clip gerado inválido ou muito pequeno: ${filePath} (${stats.size} bytes)`
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

function cutClip({
  videoPath,
  clipPath,
  start,
  duration,
  clipIndex
}) {
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
      "-preset", "veryfast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",

      "-c:a", "aac",
      "-b:a", "128k",

      "-movflags", "+faststart",
      "-threads", "1",

      clipPath
    ];

    console.log(`🎞️ [ClipAssembler] FFmpeg args clip ${clipIndex}:`);
    console.log(args.join(" "));

    const ffmpeg = spawn("ffmpeg", args);

    let stderrBuffer = "";
    let stdoutBuffer = "";

    ffmpeg.stdout.on("data", (data) => {
      const text = data.toString();
      stdoutBuffer += text;
      console.log(`[FFMPEG STDOUT clip ${clipIndex}] ${text.trim()}`);
    });

    ffmpeg.stderr.on("data", (data) => {
      const text = data.toString();
      stderrBuffer += text;
      console.error(`[FFMPEG STDERR clip ${clipIndex}] ${text.trim()}`);
    });

    ffmpeg.on("error", (err) => {
      reject(
        new Error(
          `[ClipAssembler] Erro ao iniciar FFmpeg no clip ${clipIndex}: ${err.message}`
        )
      );
    });

    ffmpeg.on("close", (code, signal) => {
      console.log(
        `📦 [ClipAssembler] FFmpeg terminou clip ${clipIndex} | code=${code} | signal=${signal || "none"}`
      );

      if (code !== 0) {
        return reject(
          new Error(
            `[ClipAssembler] FFmpeg falhou no clip ${clipIndex}. code=${code} signal=${signal || "none"} stderr=${stderrBuffer || "vazio"}`
          )
        );
      }

      if (signal) {
        return reject(
          new Error(
            `[ClipAssembler] FFmpeg interrompido no clip ${clipIndex} por signal=${signal}`
          )
        );
      }

      try {
        const size = ensureClipLooksValid(clipPath);
        console.log(
          `✅ [ClipAssembler] Clip ${clipIndex} gerado com sucesso (${(size / 1024 / 1024).toFixed(2)} MB)`
        );
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

module.exports = async function ClipAssembler({
  videoPath,
  viralMoments,
  jobId,
  jobDir,
}) {
  try {
    if (!videoPath || !fs.existsSync(videoPath)) {
      throw new Error("[ClipAssembler] Vídeo não encontrado");
    }

    if (!Array.isArray(viralMoments) || viralMoments.length === 0) {
      throw new Error("[ClipAssembler] viralMoments inválido ou vazio");
    }

    if (!jobDir) {
      throw new Error("[ClipAssembler] jobDir é obrigatório");
    }

    const clipsDir = path.join(jobDir, "clips");
    safeMkdir(clipsDir);

    console.log("🎬 [ClipAssembler] Iniciando cortes...");
    console.log("🎯 Total de clips recebidos:", viralMoments.length);
    console.log("📹 Video path:", videoPath);
    console.log("🗂️ Clips dir:", clipsDir);

    const clips = [];

    for (let i = 0; i < viralMoments.length; i++) {
      const moment = viralMoments[i];

      const start = sanitizeTime(moment.startTime ?? moment.start);
      const end = sanitizeTime(moment.endTime ?? moment.end);
      const clipIndex = Number.isFinite(Number(moment.clipIndex))
        ? Number(moment.clipIndex)
        : i;

      if (start === null || end === null) {
        console.warn(
          `⚠️ [ClipAssembler] Clip ${clipIndex} ignorado: start/end inválidos`,
          moment
        );
        continue;
      }

      if (end <= start) {
        console.warn(
          `⚠️ [ClipAssembler] Clip ${clipIndex} ignorado: end <= start (${start} -> ${end})`
        );
        continue;
      }

      const duration = end - start;

      if (duration < 1) {
        console.warn(
          `⚠️ [ClipAssembler] Clip ${clipIndex} ignorado: duração muito pequena (${duration}s)`
        );
        continue;
      }

      const clipName = `clip_${clipIndex}.mp4`;
      const clipPath = path.join(clipsDir, clipName);

      console.log(
        `✂️ [ClipAssembler] Clip ${clipIndex}: ${start.toFixed(2)}s → ${end.toFixed(2)}s (${duration.toFixed(2)}s)`
      );

      await cutClip({
        videoPath,
        clipPath,
        start,
        duration,
        clipIndex
      });

      clips.push({
        clipIndex,
        clipPath,
        startTime: start,
        endTime: end,
        duration,
        reason: moment.reason ?? null,
        priority: moment.priority ?? null,
      });
    }

    if (clips.length === 0) {
      throw new Error("[ClipAssembler] Nenhum clip válido foi gerado");
    }

    console.log("🧪 [ClipAssembler] Clips finais:");
    clips.forEach((c) => {
      console.log({
        clipIndex: c.clipIndex,
        startTime: c.startTime,
        endTime: c.endTime,
        duration: c.duration,
        clipPath: c.clipPath,
      });
    });

    console.log("🔥 [ClipAssembler] Total de clips gerados:", clips.length);

    return {
      clips,
      clipsDir,
    };
  } catch (err) {
    console.error("[ClipAssembler] ERROR:", err);
throw err;
  }
};
