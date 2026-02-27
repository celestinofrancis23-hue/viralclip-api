/**
 * selectCoreMoments.js
 *
 * Responsabilidade:
 * - Receber momentos já pontuados (scoreMoments)
 * - Normalizar duração (min/max)
 * - Agrupar momentos muito próximos
 * - Selecionar os melhores momentos finais
 *
 * Saída:
 * candidateMoments[] → pronto para Transcript Targeted
 */

function selectCoreMoments({
  moments,
  videoDuration,
  options = {}
}) {
  if (!Array.isArray(moments) || moments.length === 0) {
    return [];
  }

  const {
    maxMoments = 12,          // quantos momentos finais no máximo
    minDuration = 20,         // duração mínima de um clip (seg)
    maxDuration = 60,         // duração máxima de um clip (seg)
    mergeGap = 5,             // segundos para unir momentos próximos
    paddingBefore = 5,        // segundos antes do início
    paddingAfter = 5          // segundos depois do fim
  } = options;

  /**
   * 1️⃣ Ordenar por score (mais forte primeiro)
   */
  const sorted = [...moments].sort((a, b) => b.score - a.score);

  /**
   * 2️⃣ Selecionar os mais fortes (limite bruto)
   */
  const selected = sorted.slice(0, maxMoments * 2);

  /**
   * 3️⃣ Normalizar tempo (padding + limites)
   */
  const normalized = selected.map(m => {
    let start = Math.max(0, m.start - paddingBefore);
    let end = Math.min(videoDuration, m.end + paddingAfter);

    let duration = end - start;

    // garantir duração mínima
    if (duration < minDuration) {
      const extra = (minDuration - duration) / 2;
      start = Math.max(0, start - extra);
      end = Math.min(videoDuration, end + extra);
    }

    // garantir duração máxima
    if (end - start > maxDuration) {
      end = start + maxDuration;
    }

    return {
      ...m,
      start,
      end,
      duration: end - start
    };
  });

  /**
   * 4️⃣ Agrupar momentos muito próximos
   */
  const grouped = [];
  for (const moment of normalized.sort((a, b) => a.start - b.start)) {
    const last = grouped[grouped.length - 1];

    if (
      last &&
      moment.start - last.end <= mergeGap
    ) {
      last.end = Math.max(last.end, moment.end);
      last.score = Math.max(last.score, moment.score);
      last.duration = last.end - last.start;
      last.reasons = [...new Set([...(last.reasons || []), moment.reason])];
    } else {
      grouped.push({
        ...moment,
        reasons: [moment.reason]
      });
    }
  }

  /**
   * 5️⃣ Ordenar novamente por score e limitar
   */
  const finalMoments = grouped
    .sort((a, b) => b.score - a.score)
    .slice(0, maxMoments)
    .map((m, index) => ({
      id: `moment_${index + 1}`,
      start: Number(m.start.toFixed(2)),
      end: Number(m.end.toFixed(2)),
      duration: Number((m.end - m.start).toFixed(2)),
      score: Number(m.score.toFixed(2)),
      reasons: m.reasons
    }));

  return finalMoments;
}

module.exports = selectCoreMoments;
