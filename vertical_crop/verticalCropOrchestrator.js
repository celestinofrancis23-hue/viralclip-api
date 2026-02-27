/**
 * Vertical Crop Orchestrator
 *
 * Responsabilidade:
 * - Receber um vídeo horizontal
 * - Detectar rosto (opcional)
 * - Calcular crop X corretamente
 * - Executar FFmpeg para gerar vídeo vertical 9:16
 *
 * NÃO faz:
 * - Merge
 * - Cut
 * - Job control
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const marvelVerticalCrop = require('./marvelVerticalCrop');

module.exports = async function verticalCropOrchestrator({
  inputVideoPath,
  outputVideoPath
}) {
  // ==========================
  // 1. VALIDATION
  // ==========================
  if (!inputVideoPath || typeof inputVideoPath !== 'string') {
    throw new Error('inputVideoPath inválido');
  }

  if (!outputVideoPath || typeof outputVideoPath !== 'string') {
    throw new Error('outputVideoPath inválido');
  }

  if (!fs.existsSync(inputVideoPath)) {
    throw new Error(`Vídeo não encontrado: ${inputVideoPath}`);
  }

  // ==========================
  // 2. OUTPUT DIR
  // ==========================
  fs.mkdirSync(path.dirname(outputVideoPath), { recursive: true });

  console.log('🎬 Vertical crop iniciado:', inputVideoPath);

  // ==========================
  // 3. FACE DETECTION
  // ==========================
  const cropData = await marvelVerticalCrop({
    inputPath: inputVideoPath
  });

  const face = cropData?.face || null;
  const faceDetected = !!face;

  // ==========================
  // 4. CROP CALCULATION
  // ==========================
  const VIDEO_WIDTH = 1920;   // após scale
  const VIDEO_HEIGHT = 1280;
  const CROP_WIDTH = 720;
  const CROP_HEIGHT = 1280;

  let cropX;

  if (faceDetected) {
    const faceCenterX = face.x + face.width / 2;
    cropX = Math.round(faceCenterX - CROP_WIDTH / 2);
    console.log('🙂 Rosto detectado → crop centrado no rosto');
  } else {
    cropX = Math.round((VIDEO_WIDTH - CROP_WIDTH) / 2);
    console.log('⚠️ Nenhum rosto → center crop');
  }

  // Clamp de segurança
  cropX = Math.max(0, Math.min(cropX, VIDEO_WIDTH - CROP_WIDTH));

  // ==========================
  // 5. FFMPEG
  // ==========================
  const ffmpegCmd = `
ffmpeg -y -i "${inputVideoPath}" \
-vf "scale=1920:1280,crop=${CROP_WIDTH}:${CROP_HEIGHT}:${cropX}:0" \
-c:v libx264 -preset fast -crf 18 \
"${outputVideoPath}"
`.trim();

  await new Promise((resolve, reject) => {
    exec(ffmpegCmd, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  console.log('✅ Vertical crop finalizado:', outputVideoPath);

  return {
    inputVideoPath,
    outputVideoPath,
    cropX,
    faceDetected
  };
};

