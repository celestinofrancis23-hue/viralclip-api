function FixedVerticalCropBuilder({
  dominantFace,
  videoWidth,
  videoHeight,
}) {
  const ASPECT_RATIO = 9 / 16;

  // Altura total
  const cropHeight = videoHeight;
  const cropWidth = Math.round(cropHeight * ASPECT_RATIO);

  // Centro do rosto
  const faceCenterX =
    dominantFace.x + dominantFace.w / 2;

  // Crop centralizado no rosto
  let cropX = Math.round(
    faceCenterX - cropWidth / 2
  );

  // Limites de segurança
  if (cropX < 0) cropX = 0;
  if (cropX + cropWidth > videoWidth) {
    cropX = videoWidth - cropWidth;
  }

  return {
    x: cropX,
    y: 0,
    width: cropWidth,
    height: cropHeight,
    aspectRatio: "9:16",
  };
}

module.exports = FixedVerticalCropBuilder;
