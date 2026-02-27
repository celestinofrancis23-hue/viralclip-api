// workers/video/normalizeVideoEvents.js

/**
 * Normaliza eventos de movimento do vídeo
 * Transforma eventos brutos em segmentos contínuos
 */
function normalizeVideoEvents(
  rawEvents,
  options = {}
) {
  const {
    maxGap = 0.4,        // tempo máximo entre eventos (s)
    minDuration = 0.6,   // duração mínima do segmento (s)
  } = options;

  if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
    return [];
  }

  // Garantir ordem temporal
  const events = [...rawEvents].sort((a, b) => a.time - b.time);

  const segments = [];
  let current = null;

  for (const event of events) {
    if (!current) {
      current = {
        start: event.time,
        end: event.time,
        scores: [event.score]
      };
      continue;
    }

    const gap = event.time - current.end;

    if (gap <= maxGap) {
      // Continua o mesmo segmento
      current.end = event.time;
      current.scores.push(event.score);
    } else {
      // Fecha segmento anterior
      pushSegmentIfValid(current, segments, minDuration);

      // Inicia novo
      current = {
        start: event.time,
        end: event.time,
        scores: [event.score]
      };
    }
  }

  // Último segmento
  if (current) {
    pushSegmentIfValid(current, segments, minDuration);
  }

  return segments;
}

function pushSegmentIfValid(segment, segments, minDuration) {
  const duration = segment.end - segment.start;

  if (duration < minDuration) return;

  const avgScore =
    segment.scores.reduce((a, b) => a + b, 0) /
    segment.scores.length;

  segments.push({
    start: round(segment.start),
    end: round(segment.end),
    score: round(avgScore, 2),
    reason: 'motion'
  });
}

function round(value, decimals = 3) {
  return Number(value.toFixed(decimals));
}

module.exports = normalizeVideoEvents;
