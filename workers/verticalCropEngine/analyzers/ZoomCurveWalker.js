// workers/verticalCropEngine/walkers/ZoomCurveWalker.js

module.exports = function ZoomCurveWalker({
  cropPath = [],
  visualFocusTimeline = [],
  clipDuration
}) {
  if (!Array.isArray(cropPath)) {
    throw new Error("[ZoomCurveWalker] cropPath inválido");
  }

  const zoomPath = [];

  for (const segment of visualFocusTimeline) {
    const baseZoom = getBaseZoom(segment.focusType);

    // entrada suave
    zoomPath.push({
      time: segment.start,
      zoom: 1.0
    });

    zoomPath.push({
      time: segment.start + 0.4,
      zoom: baseZoom
    });

    // saída suave
    zoomPath.push({
      time: segment.end - 0.4,
      zoom: baseZoom
    });

    zoomPath.push({
      time: segment.end,
      zoom: 1.0
    });
  }

  // 🔒 garantir limites
  return {
    zoomPath: smoothAndClamp(zoomPath)
  };
};

/* ========================================================= */

function getBaseZoom(focusType) {
  switch (focusType) {
    case "speaker":
      return 1.12;
    case "face":
      return 1.15;
    case "motion":
      return 1.05;
    default:
      return 1.0;
  }
}

function smoothAndClamp(path) {
  return path
    .filter(p => p.time >= 0)
    .map(p => ({
      time: Number(p.time.toFixed(2)),
      zoom: Number(Math.min(Math.max(p.zoom, 1.0), 1.25).toFixed(3))
    }));
}
