// workers/cropPatchWorker.js

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function getFaceAtTime(faceTimeline, time) {
  // pega a face mais próxima no tempo
  let closest = null;
  let minDiff = Infinity;

  for (const frame of faceTimeline) {
    const diff = Math.abs(frame.time - time);
    if (diff < minDiff) {
      minDiff = diff;
      closest = frame;
    }
  }

  return closest;
}

module.exports = function CropPatchWalker({
  clipDuration,
  videoResolution,
  targetAspectRatio,
  faceAnalysis,
  visualFocus
}) {
  const { width: videoW, height: videoH } = videoResolution;
  const aspect = targetAspectRatio.width / targetAspectRatio.height;

  // calcula tamanho do crop (9:16 dentro do vídeo horizontal)
  let cropHeight = videoH;
  let cropWidth = cropHeight * aspect;

  if (cropWidth > videoW) {
    cropWidth = videoW;
    cropHeight = cropWidth / aspect;
  }

  const cropTimeline = [];

  for (const focus of visualFocus.focusTimeline) {
    const midTime = (focus.start + focus.end) / 2;

    const faceFrame = getFaceAtTime(faceAnalysis.faceTimeline, midTime);

    if (!faceFrame) continue;

    // face box normalizada → pixels
    const faceX = faceFrame.faceBox.x * videoW;
    const faceY = faceFrame.faceBox.y * videoH;
    const faceW = faceFrame.faceBox.w * videoW;
    const faceH = faceFrame.faceBox.h * videoH;

    const faceCenterX = faceX + faceW / 2;
    const faceCenterY = faceY + faceH / 2;

    // centraliza crop na face
    let cropX = faceCenterX - cropWidth / 2;
    let cropY = faceCenterY - cropHeight / 2;

    // garante limites do vídeo
    cropX = clamp(cropX, 0, videoW - cropWidth);
    cropY = clamp(cropY, 0, videoH - cropHeight);

    cropTimeline.push({
      start: focus.start,
      end: focus.end,
      cropBox: {
        x: Math.round(cropX),
        y: Math.round(cropY),
        width: Math.round(cropWidth),
        height: Math.round(cropHeight)
      },
      targetFaceId: focus.targetFaceId,
      reason: focus.focusType
    });
  }

  return {
    cropTimeline
  };
};
