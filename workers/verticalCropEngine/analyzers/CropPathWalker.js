// workers/verticalCropEngine/walkers/CropPathWalker.js

module.exports = function CropPathWalker({
  visualFocusTimeline = [],
  clipDuration,
  sourceWidth,
  sourceHeight,
  targetAspect = "9:16"
}) {
  if (!Array.isArray(visualFocusTimeline)) {
    throw new Error("[CropPathWalker] visualFocusTimeline inválido");
  }

  const aspectRatio = 9 / 16;

  // ============================
  // 1️⃣ Calcular tamanho do crop
  // ============================
  const cropHeight = sourceHeight;
  const cropWidth = cropHeight * aspectRatio;

  const maxX = sourceWidth - cropWidth;
  const maxY = sourceHeight - cropHeight;

  const MAX_SPEED = 800; // px / segundo
  const DEAD_ZONE = 0.02; // normalizado

  let lastCrop = null;
  const cropPath = [];

  for (const focus of visualFocusTimeline) {
    const targetCenterX = focus.center.x * sourceWidth;
    const targetCenterY = focus.center.y * sourceHeight;

    let targetX = targetCenterX - cropWidth / 2;
    let targetY = targetCenterY - cropHeight / 2;

    // Clamp nos limites
    targetX = clamp(targetX, 0, maxX);
    targetY = clamp(targetY, 0, maxY);

    if (lastCrop) {
      const dx = targetX - lastCrop.x;
      const dy = targetY - lastCrop.y;

      const dist = Math.hypot(dx, dy);

      // Dead zone
      if (dist / sourceWidth < DEAD_ZONE) {
        targetX = lastCrop.x;
        targetY = lastCrop.y;
      } else {
        // Limitar velocidade
        const maxMove = MAX_SPEED * (focus.start - lastCrop.time);
        if (dist > maxMove) {
          const ratio = maxMove / dist;
          targetX = lastCrop.x + dx * ratio;
          targetY = lastCrop.y + dy * ratio;
        }
      }
    }

    const crop = {
      x: Math.round(targetX),
      y: Math.round(targetY),
      width: Math.round(cropWidth),
      height: Math.round(cropHeight)
    };

    cropPath.push({
      time: focus.start,
      crop
    });

    lastCrop = {
      ...crop,
      time: focus.start
    };
  }

  return { cropPath };
};

/* ========================================================= */

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
