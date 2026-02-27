/**
 * mergeEvents.js
 *
 * Responsabilidade:
 * Unificar eventos de áudio e vídeo em uma linha do tempo comum
 * sem tomar decisões de corte.
 *
 * Entrada:
 * - audioEvents: [{ start, end, score, type, metadata }]
 * - videoEvents: [{ start, end, score, type, metadata }]
 *
 * Saída:
 * - mergedEvents: [{ start, end, audioScore, videoScore, combinedScore, sources }]
 */

function mergeEvents({ audioEvents = [], videoEvents = [] }) {
  if (!Array.isArray(audioEvents)) {
    throw new Error('[mergeEvents] audioEvents deve ser um array');
  }

  if (!Array.isArray(videoEvents)) {
    throw new Error('[mergeEvents] videoEvents deve ser um array');
  }

  // Normaliza eventos em uma estrutura comum
  const normalizedAudio = audioEvents.map(e => ({
    start: e.start,
    end: e.end,
    audioScore: e.score ?? 0,
    videoScore: 0,
    sources: ['audio'],
    metadata: {
      audio: e.metadata || {}
    }
  }));

  const normalizedVideo = videoEvents.map(e => ({
    start: e.start,
    end: e.end,
    audioScore: 0,
    videoScore: e.score ?? 0,
    sources: ['video'],
    metadata: {
      video: e.metadata || {}
    }
  }));

  const allEvents = [...normalizedAudio, ...normalizedVideo]
    .sort((a, b) => a.start - b.start);

  const merged = [];

  for (const event of allEvents) {
    const last = merged[merged.length - 1];

    // Se não há evento anterior ou não há sobreposição
    if (!last || event.start > last.end) {
      merged.push({
        start: event.start,
        end: event.end,
        audioScore: event.audioScore,
        videoScore: event.videoScore,
        combinedScore: event.audioScore + event.videoScore,
        sources: [...event.sources],
        metadata: { ...event.metadata }
      });
      continue;
    }

    // Há sobreposição → mescla
    last.end = Math.max(last.end, event.end);
    last.audioScore += event.audioScore;
    last.videoScore += event.videoScore;
    last.combinedScore = last.audioScore + last.videoScore;

    event.sources.forEach(src => {
      if (!last.sources.includes(src)) {
        last.sources.push(src);
      }
    });

    last.metadata = {
      ...last.metadata,
      ...event.metadata
    };
  }

  return merged;
}

module.exports = mergeEvents;
