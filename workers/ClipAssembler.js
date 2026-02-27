const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

module.exports = async function ClipAssembler({
  videoPath,
  viralMoments,
  jobId,
  jobDir,
}) {
  return new Promise(async (resolve, reject) => {
    try {
      // ============================
      // 1. Validação básica
      // ============================
      if (!videoPath || !fs.existsSync(videoPath)) {
        throw new Error("[ClipAssembler] Vídeo não encontrado");
      }

      if (!Array.isArray(viralMoments) || viralMoments.length === 0) {
        throw new Error("[ClipAssembler] viralMoments inválido ou vazio");
      }

      const clipsDir = path.join(jobDir, "clips");
      if (!fs.existsSync(clipsDir)) {
        fs.mkdirSync(clipsDir, { recursive: true });
      }

      console.log("🎬 [ClipAssembler] Iniciando cortes...");
      console.log("🎯 Total de clips:", viralMoments.length);

      const clips = [];

      // ============================
      // 2. Processar cada momento
      // ============================
      for (let i = 0; i < viralMoments.length; i++) {
        const moment = viralMoments[i];

        // 🔁 SUPORTE A FORMATO ANTIGO E NOVO
        const start =
          Number(moment.startTime ?? moment.start);

        const end =
          Number(moment.endTime ?? moment.end);

        const clipIndex =
          Number(moment.clipIndex ?? i);

        if (isNaN(start) || isNaN(end) || end <= start) {
          console.warn(`⚠️ [ClipAssembler] Clip ${clipIndex} ignorado (tempo inválido)`);
          continue;
        }

        const duration = end - start;
        const clipName = `clip_${clipIndex}.mp4`;
        const clipPath = path.join(clipsDir, clipName);

        console.log(
          `✂️ Clip ${clipIndex}: ${start}s → ${end}s (${duration.toFixed(2)}s)`
        );

        // ============================
        // 3. FFmpeg CUT
        // ============================
        await new Promise((res, rej) => {
          const ffmpeg = spawn("ffmpeg", [
            "-y",
            "-ss", start.toString(),
            "-i", videoPath,
            "-t", duration.toString(),
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "18",
            "-c:a", "aac",
            "-movflags", "+faststart",
            clipPath,
          ]);

          ffmpeg.on("error", (err) => {
            rej(
              new Error(
                `[ClipAssembler] FFmpeg erro no clip ${clipIndex}: ${err.message}`
              )
            );
          });

          ffmpeg.on("close", (code) => {
            if (code !== 0) {
              return rej(
                new Error(
                  `[ClipAssembler] FFmpeg falhou no clip ${clipIndex} (code ${code})`
                )
              );
            }
            res();
          });
        });

clips.push({
  clipIndex,
  clipPath,

  // 🔑 CONTRATO CORRETO
  startTime: start,
  endTime: end,
  duration,

  reason: moment.reason ?? null,
  priority: moment.priority ?? null,
});
      }

console.log("🧪 [ClipAssembler] Clips finais:");
clips.forEach(c => {
  console.log({
    clipIndex: c.clipIndex,
    startTime: c.startTime,
    endTime: c.endTime,
    duration: c.duration,
  });
});

      // ============================
      // 4. Finalização
      // ============================
      console.log("🔥 [ClipAssembler] Clips gerados:", clips.length);

      resolve({
        clips,
        clipsDir,
      });
    } catch (err) {
      reject(err);
    }
  });
};

