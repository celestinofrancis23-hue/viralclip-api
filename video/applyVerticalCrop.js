const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

function applyVerticalCrop({ inputPath, outputPath }) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error("Input clip não encontrado"));
    }

    // Garantir pasta de destino
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    /**
     * Estratégia:
     * - Crop central baseado na altura
     * - Escala final para 1080x1920
     */
    const ffmpegCmd = `
      ffmpeg -y -i "${inputPath}" \
      -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920" \
      -c:a copy \
      "${outputPath}"
    `;

    console.log("[CROP] Executando FFmpeg:", ffmpegCmd);

    exec(ffmpegCmd, (error) => {
      if (error) {
        console.error("[CROP] Erro FFmpeg:", error);
        return reject(error);
      }

      if (!fs.existsSync(outputPath)) {
        return reject(new Error("Output vertical não foi gerado"));
      }

      console.log("[CROP] Clip vertical gerado:", outputPath);
      resolve(outputPath);
    });
  });
}

module.exports = applyVerticalCrop;
