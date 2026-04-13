// workers/verticalCropEngine/analyzers/VisualFocusRanker.js
//
// Combina faceTimeline, motionTimeline e speakerTimeline para determinar
// o tipo de foco visual em cada momento do clip.
// Output usado pelo ZoomCurveWalker para definir o nível de zoom.

module.exports = function VisualFocusRanker({
  speakerTimeline = [],
  faceTimeline    = [],   // [{time, center:{x,y}, faceBox, confidence}]
  motionTimeline  = []    // [{time, energy}]
}) {
  const events = [];

  // ────────────────────────────────────────────────────────────────────────
  // 1. Converter faceTimeline per-frame → segmentos com start/end
  // ────────────────────────────────────────────────────────────────────────
  for (let i = 0; i < faceTimeline.length; i++) {
    const cur  = faceTimeline[i];
    const next = faceTimeline[i + 1];

    if (!cur || !cur.center) continue;

    const start = cur.time;
    const end   = next ? next.time : start + 0.5;

    events.push({
      start,
      end,
      type:       "face",
      center:     cur.center,
      bbox:       cur.faceBox || null,
      confidence: cur.confidence || 0.8,
      reason:     ["face_detected"]
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // 2. Normalizar eventos de motion
  // ────────────────────────────────────────────────────────────────────────
  for (let i = 0; i < motionTimeline.length; i++) {
    const cur  = motionTimeline[i];
    const next = motionTimeline[i + 1];

    if (!cur) continue;

    events.push({
      start:      cur.time,
      end:        next ? next.time : cur.time + 0.2,
      type:       "motion",
      center:     { x: 0.5, y: 0.5 },
      bbox:       null,
      confidence: normaliseEnergy(cur.energy),
      reason:     ["motion_energy"]
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // 3. Ordenar por tempo
  // ────────────────────────────────────────────────────────────────────────
  events.sort((a, b) => a.start - b.start);

  // ────────────────────────────────────────────────────────────────────────
  // 4. Construir foco visual contínuo (prioridade: face+fala > face > motion)
  // ────────────────────────────────────────────────────────────────────────
  const visualFocusTimeline = [];
  let lastFocus = null;

  for (const event of events) {
    const isSpeaking = speakerTimeline.some(
      s => event.start >= s.start && event.start <= s.end
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

    if (!lastFocus || priority >= lastFocus.priority) {
      const focus = {
        start:      event.start,
        end:        event.end,
        focusType:  event.type,
        center:     event.center,
        bbox:       event.bbox,
        confidence: clamp(event.confidence),
        reason:     event.reason,
        priority
      };

      visualFocusTimeline.push(focus);
      lastFocus = focus;
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // 5. Limpar e normalizar overlaps
  // ────────────────────────────────────────────────────────────────────────
  return {
    visualFocusTimeline: normalizeTimeline(visualFocusTimeline)
  };
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function normaliseEnergy(energy) {
  // energia raw dos bytes do frame — normalizar para [0,1]
  return clamp(energy / 100);
}

function clamp(v) {
  return Math.max(0, Math.min(1, v || 0));
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
      last.end        = block.end;
      last.confidence = Math.max(last.confidence, block.confidence);
    } else {
      result.push({ ...block });
    }
  }

  return result.map(({ priority, ...rest }) => rest);
}

function distance(a, b) {
  if (!a || !b) return 1;
  return Math.hypot(a.x - b.x, a.y - b.y);
}
