/**
 * Zoom Curve Worker
 * Gera uma timeline simples de zoom baseada em foco + movimento
 */

module.exports = function ZoomCurveWorker({
  cropTimeline = [],
  motionTimeline = [],
  focusTimeline = [],
  clipDuration = 0
}) {
  // Segurança básica
  if (!clipDuration || clipDuration <= 0) {
    return {
      zoomTimeline: [],
      strategy: "none"
    };
  }

  const zoomTimeline = [];

  // Regra simples:
  // - Speaker face → zoom leve
  // - Movimento alto → reduz zoom
  // - Tudo suave (sem jumps)

  const BASE_ZOOM = 1.0;
  const SPEAKER_ZOOM = 1.08;
  const MOTION_REDUCE = 0.95;

  // Se não houver foco, aplica zoom neutro no clip inteiro
  if (!focusTimeline.length) {
    zoomTimeline.push({
      start: 0,
      end: clipDuration,
      zoom: BASE_ZOOM,
      reason: "no_focus"
    });

    return {
      zoomTimeline,
      strategy: "static"
    };
  }

  // Para cada bloco de foco
  for (const focus of focusTimeline) {
    let zoomValue = BASE_ZOOM;

    // Se foco for no speaker/face → aproxima levemente
    if (
      focus.focusType === "speaker_face" ||
      focus.focusType === "face"
    ) {
      zoomValue = SPEAKER_ZOOM;
    }

    // Verifica se existe movimento nesse intervalo
    const hasMotion = motionTimeline.some(m =>
      m.start < focus.end && m.end > focus.start && m.energy > 0.6
    );

    if (hasMotion) {
      zoomValue *= MOTION_REDUCE;
    }

    zoomTimeline.push({
      start: focus.start,
      end: focus.end,
      zoom: Number(zoomValue.toFixed(3)),
      reason: hasMotion ? "focus_with_motion" : "focus"
    });
  }

  return {
    zoomTimeline,
    strategy: "focus_based"
  };
};
