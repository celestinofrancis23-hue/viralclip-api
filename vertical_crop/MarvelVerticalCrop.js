const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const detectFace = require('./faceDetection');

/**
 * Marvel Vertical Crop — Human Framing Edition
 * Objetivo: enquadrar PESSOA (rosto + ombros + torso)
 * usando rosto como âncora, não como limite.
 */

async function marvelVerticalCrop({
  jobId,
  clipId,
  inputVideoPath,
}) {
  // ============================
  // VALIDACOES
  // ============================
  if (!jobId) throw new Error('marvelVerticalCrop: jobId ausente');
  if (!clipId) throw new Error('marvelVerticalCrop: clipId ausente');
  if (!inputVideoPath || !fs.existsSync(inputVideoPath)) {
    throw new Error(`Vídeo não encontrado: ${inputVideoPath}`);
  }

  // ============================
  // FRAME DE REFERENCIA
  // ============================
  const framesDir = path.resolve('temp', 'frames', jobId);
  fs.mkdirSync(framesDir, { recursive: true });

  const framePath = path.join(framesDir, `${clipId}_frame.jpg`);

  await execPromise(
    `ffmpeg -y -ss 1 -i "${inputVideoPath}" -frames:v 1 "${framePath}"`
  );

  // ============================
  // FACE DETECTION
  // ============================
  const face = await detectFace(framePath);

  // ============================
  // METADADOS DO VIDEO
  // ============================
  const { width: videoWidth, height: videoHeight } =
    await probeVideo(inputVideoPath);

  // ============================
  // CONFIGURACAO 9:16 REAL
  // ============================
  const CROP_HEIGHT = Math.min(videoHeight, 1280);
  const CROP_WIDTH = Math.round(CROP_HEIGHT * 9 / 16);

  let cropX;
  let cropY;
  let strategy = 'center-fallback';

  // ============================
  // LOGICA HUMANA
  // ============================
  if (face?.found && face.box) {
    const { x, y, width, height } = face.box;

    const faceCenterX = x + width / 2;
    const faceTopY = y;

    /**
     * Queremos:
     * - rosto no topo superior
     * - espaço abaixo para ombros e torso
     */
    const FACE_TOP_RATIO = 0.22; // rosto a 18% do topo
    const desiredFaceTop = CROP_HEIGHT * FACE_TOP_RATIO;

    cropY = faceTopY - desiredFaceTop;

    // Clamp vertical
    cropY = Math.max(
      0,
      Math.min(cropY, videoHeight - CROP_HEIGHT)
    );

    // Horizontal: centraliza no rosto
    cropX = faceCenterX - CROP_WIDTH / 2;

    cropX = Math.max(
      0,
      Math.min(cropX, videoWidth - CROP_WIDTH)
    );

    strategy = 'person-centered';
  } else {
    // Fallback seguro
    cropX = Math.round((videoWidth - CROP_WIDTH) / 2);
    cropY = Math.round((videoHeight - CROP_HEIGHT) / 2);
  }

  // ============================
  // OUTPUT LIMPO
  // ============================
  return {
    jobId,
    clipId,
    inputVideoPath,
    cropDecision: {
      cropX: Math.round(cropX),
      cropY: Math.round(cropY),
      cropWidth: CROP_WIDTH,
      cropHeight: CROP_HEIGHT,
      strategy,
    },
  };
}

// ============================
// HELPERS
// ============================

function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function probeVideo(videoPath) {
  return new Promise((resolve, reject) => {
    exec(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of json "${videoPath}"`,
      (err, stdout) => {
        if (err) return reject(err);
        const data = JSON.parse(stdout);
        resolve({
          width: data.streams[0].width,
          height: data.streams[0].height,
        });
      }
    );
  });
}

module.exports = marvelVerticalCrop;
