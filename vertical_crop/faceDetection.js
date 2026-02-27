const path = require('path');
const fs = require('fs');
const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// 📌 caminho dos modelos
const MODELS_PATH = path.join(__dirname, 'models');

// 🔒 carrega modelos uma única vez
let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;

  console.log('🤖 Carregando modelos de face detection...');

  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_PATH);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH);

  modelsLoaded = true;
  console.log('✅ Modelos carregados');
}

/**
 * Detecta o rosto principal em um frame
 * @param {string} framePath
 * @returns {Promise<{found: boolean, box?: {x,y,width,height}}>}
 */
async function detectFace(framePath) {
  try {
    await loadModels();

    if (!fs.existsSync(framePath)) {
      console.warn('⚠️ Frame não encontrado:', framePath);
      return { found: false };
    }

    console.log('🔍 Analisando frame:', framePath);

    const img = await canvas.loadImage(framePath);

    const detections = await faceapi
      .detectAllFaces(img)
      .withFaceLandmarks();

    if (!detections || detections.length === 0) {
      console.log('🚫 Nenhum rosto detectado');
      return { found: false };
    }

    // 🎯 escolhe o maior rosto (principal)
    let mainFace = detections[0];
    let maxArea = 0;

    for (const det of detections) {
      const box = det.detection.box;
      const area = box.width * box.height;

      if (area > maxArea) {
        maxArea = area;
        mainFace = det;
      }
    }

    const { x, y, width, height } = mainFace.detection.box;

    console.log('✅ Rosto detectado:', {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height)
    });

    return {
      found: true,
      box: {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height)
      }
    };

  } catch (err) {
    console.error('❌ Erro no faceDetection:', err.message);
    return { found: false };
  }
}

module.exports = detectFace;
