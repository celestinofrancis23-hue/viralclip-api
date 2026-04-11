module.exports = function FixedVerticalCropBuilder({
  dominantFace,
  videoWidth,
  videoHeight
}) {
  const cropWidth = 607;
  const cropHeight = videoHeight;

  // fallback
  if (!dominantFace || dominantFace.x === undefined) {
    return {
      width: cropWidth,
      height: cropHeight,
      x: (videoWidth - cropWidth) / 2,
      y: 0,
    };
  }

  const centerX = dominantFace.x + dominantFace.width / 2;

  let cropX = centerX - cropWidth / 2;

  // clamp
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
}
