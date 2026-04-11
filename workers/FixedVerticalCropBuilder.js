module.exports = function FixedVerticalCropBuilder({
  frames,
  videoWidth,
  videoHeight,
}) {
  const cropWidth = 607;
  const cropHeight = videoHeight;

  // 🔥 margem de segurança (ESSENCIAL)
  const SAFE_MARGIN = 100;

  // 🛑 fallback total (sem frames)
  if (!frames || !Array.isArray(frames) || frames.length === 0) {
    return {
      width: cropWidth,
      height: cropHeight,
      x: Math.round((videoWidth - cropWidth) / 2),
      y: 0,
    };
  }

  // 🔥 calcular média dos centros
  let sumX = 0;
  let validFrames = 0;

  for (const frame of frames) {
    if (
      frame &&
      typeof frame.x === "number" &&
      typeof frame.width === "number"
    ) {
      const center = frame.x + frame.width / 2;
      sumX += center;
      validFrames++;
    }
  }

  // 🛑 fallback se inválido
  if (validFrames === 0) {
    return {
      width: cropWidth,
      height: cropHeight,
      x: Math.round((videoWidth - cropWidth) / 2),
      y: 0,
    };
  }

  // 🎯 centro médio
  const avgCenterX = sumX / validFrames;

  // 🔥 aplicar margem de segurança
  let cropX = avgCenterX - cropWidth / 2;

  // 👉 adiciona "respiro" lateral
  cropX -= SAFE_MARGIN / 2;

  // 🛑 clamp (não sair do vídeo)
  if (cropX < 0) cropX = 0;

  if (cropX + cropWidth > videoWidth) {
    cropX = videoWidth - cropWidth;
  }

  return {
    width: cropWidth,
    height: cropHeight,
    x: Math.round(cropX),
    y: 0,
  };
};
