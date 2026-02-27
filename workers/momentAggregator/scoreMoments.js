/**
 * scoreMoments.js
 *
 * Responsabilidade:
 * Calcular score final de cada momento candidato
 * sem decidir cortes nem quantidade final.
 */

function scoreMoments({
  mergedEvents = [],
  config = {}
}) {
  if (!Array.isArray(mergedEvents)) {
    throw new Error('[scoreMoments] mergedEvents deve ser um array');
  }

  const {
    minDuration = 2,      // segundos
    maxDuration = 90,     // segundos
    audioWeight = 1.2,
    videoWeight = 1.0,
    multiSourceBonus = 1.15
  } = config;

  return mergedEvents.map(event => {
    const duration = event.end - event.start;

    // Penaliza eventos muito curtos ou longos demais
    let durationWeight = 1;
    if (duration < minDuration) durationWeight = 0.4;
    if (duration > maxDuration) durationWeight = 0.7;

    // Peso de fonte (áudio + vídeo juntos)
    const hasAudio = event.audioScore > 0;
    const hasVideo = event.videoScore > 0;
    const sourceWeight =
      hasAudio && hasVideo ? multiSourceBonus : 1;

    // Score final
    const score =
      (
        (event.audioScore * audioWeight) +
        (event.videoScore * videoWeight)
      ) *
      durationWeight *
      sourceWeight;

    return {
      start: event.start,
      end: event.end,
      duration,
      score,
      breakdown: {
        audio: event.audioScore,
        video: event.videoScore,
        durationWeight,
        sourceWeight
      },
      sources: event.sources,
      metadata: event.metadata || {}
    };
  });
}

module.exports = scoreMoments;
