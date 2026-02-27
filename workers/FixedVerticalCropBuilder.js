module.exports = function FixedVerticalCropBuilder({
  dominantFace,
  videoWidth,
  videoHeight,
}) {
  const TARGET_RATIO = 9 / 16;

  // altura fixa = vídeo original
  const cropHeight = videoHeight;
  const cropWidth = Math.round(cropHeight * TARGET_RATIO);

  // centro REAL da face
  const faceCenterX = dominantFace.x + dominantFace.w / 2;

  // crop centralizado na face
  let cropX = Math.round(faceCenterX - cropWidth / 2);

  // clamp horizontal (NUNCA sair do vídeo)
  if (cropX < 0) cropX = 0;
  if (cropX + cropWidth > videoWidth) {
    cropX = videoWidth - cropWidth;
  }

  // vertical fixo (topo)
  const cropY = 0;

  return {
    x: cropX,
    y: cropY,
    width: cropWidth,
    height: cropHeight,
  };
};
