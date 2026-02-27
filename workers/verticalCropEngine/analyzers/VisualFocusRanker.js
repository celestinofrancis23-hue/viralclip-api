// workers/verticalCropEngine/analyzers/VisualFocusRanker.js

module.exports = function VisualFocusRanker({
  speakerTimeline = [],
  faceTimeline = [],
  motionTimeline = []
}) {
  const events = [];

  // ============================
  // 1️⃣ Normalizar eventos de FACE
  // ============================
  for (const face of faceTimeline) {
    events.push({
      start: face.start,
      end: face.end,
      type: "face",
      center: bboxCenter(face.bbox),
      bbox: face.bbox,
      confidence: face.dominanceScore,
      reason: ["face_dominant"]
    });
  }

  // ============================
  // 2️⃣ Normalizar eventos de MOTION
  // ============================
  for (const motion of motionTimeline) {
    events.push({
      start: motion.start,
      end: motion.end,
      type: "motion",
      center: motion.center,
      bbox: null,
      confidence: motion.energy,
      reason: ["motion_energy"]
    });
  }

  // ============================
  // 3️⃣ Ordenar eventos no tempo
  // ============================
  events.sort((a, b) => a.start - b.start);

  // ============================
  // 4️⃣ Construir foco contínuo
  // ============================
  const visualFocusTimeline = [];
  let lastFocus = null;

  for (const event of events) {
    const isSpeaking = isSpeakingAt(
      event.start,
      speakerTimeline
    );

    let priority = 0;

    if (event.type === "face" && isSpeaking) {
      priority = 3;
      event.reason.push("speaking");
    } else if (event.type === "face") {
      priority = 2;
    } else if (event.type === "motion") {
      priority = 1;
    }

    if (!lastFocus || priority > lastFocus.priority) {
      const focus = {
        start: event.start,
        end: event.end,
        focusType: event.type,
        center: event.center,
        bbox: event.bbox,
        confidence: clamp(event.confidence),
        reason: event.reason,
        priority
      };

      visualFocusTimeline.push(focus);
      lastFocus = focus;
    }
  }

  // ============================
  // 5️⃣ Limpar overlaps e ajustar
  // ============================
  return {
    visualFocusTimeline: normalizeTimeline(visualFocusTimeline)
  };
};

/* =========================================================
   🔧 Helpers
========================================================= */

function isSpeakingAt(time, speakerTimeline) {
  return speakerTimeline.some(
    s => time >= s.start && time <= s.end
  );
}

function bboxCenter(bbox) {
  if (!bbox) return { x: 0.5, y: 0.5 };

  return {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2
  };
}

function clamp(v) {
  return Math.max(0, Math.min(1, v));
}

function normalizeTimeline(timeline) {
  const result = [];

  for (const block of timeline) {
    const last = result[result.length - 1];

    if (
      last &&
      last.focusType === block.focusType &&
      distance(last.center, block.center) < 0.05
    ) {
      last.end = block.end;
      last.confidence = Math.max(
        last.confidence,
        block.confidence
      );
    } else {
      result.push({ ...block });
    }
  }

  return result.map(({ priority, ...rest }) => rest);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
