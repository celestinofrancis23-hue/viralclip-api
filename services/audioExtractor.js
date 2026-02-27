// services/audioExtractor.js
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

module.exports = function audioExtractor({ videoPath, jobId, jobDir }) {
  return new Promise((resolve, reject) => {
    if (!videoPath || !fs.existsSync(videoPath)) {
      return reject(new Error("Video não encontrado para extração de áudio"));
    }

    const audioPath = path.join(jobDir, "audio.wav");

    console.log(`🎧 [AudioExtractor] Extraindo áudio do vídeo...`);
    console.log(`📄 Video: ${videoPath}`);
    console.log(`🎵 Audio: ${audioPath}`);

    const command = `
      ffmpeg -y -i "${videoPath}" \
      -ac 1 \
      -ar 16000 \
      -vn \
      "${audioPath}"
    `;

    exec(command, (error) => {
      if (error) {
        console.error("❌ [AudioExtractor] Erro ao extrair áudio:", error);
        return reject(error);
      }

      if (!fs.existsSync(audioPath)) {
        return reject(new Error("Áudio não foi gerado"));
      }

      console.log(`✅ [AudioExtractor] Áudio extraído com sucesso`);
      resolve({ audioPath });
    });
  });
};
