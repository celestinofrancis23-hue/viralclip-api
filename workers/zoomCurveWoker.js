function ZoomCurveWorker({
  cropTimeline,
  motionTimeline = [],
  focusTimeline = [],
  clipDuration
}) {
  const zoomTimeline = [];

  const ZOOM_MIN = 1.0;
  const ZOOM_MAX = 1.07;

  for (const segment of cropTimeline) {
    const { start, end } = segment;

    const motionSlice = motionTimeline.filter(
      m => m.time >= start && m.time <= end
    );

    const avgMotion =
      motionSlice.reduce((sum, m) => sum + m.energy, 0) /
      (motionSlice.length || 1);

    let zoom = ZOOM_MAX;

    if (avgMotion > 0.6) zoom = 1.02;
    else if (avgMotion > 0.3) zoom = 1.04;

    zoomTimeline.push({
      start,
      end,
      zoom,
      easing: "easeInOut",
      reason: "motion_adaptive"
    });
  }

  return {
    zoomTimeline,
    zoomStrategy: "adaptive_motion"
  };
}

module.exports = ZoomCurveWorker;
