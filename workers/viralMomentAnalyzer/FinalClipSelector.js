// workers/ViralMomentAnalyzer/FinalClipSelector.js

/**
 * FinalClipSelector
 * Responsável por escolher os clipes finais que serão exportados.
 */
module.exports = function FinalClipSelector({
  clips,
  clipCount,
  minGapSeconds = 10
}) {
  if (!Array.isArray(clips)) {
    throw new Error('[FinalClipSelector] clips inválido');
  }

  if (typeof clipCount !== 'number' || clipCount <= 0) {
    throw new Error('[FinalClipSelector] clipCount inválido');
  }

  // 1️⃣ Ordena por score (desc)
  const sorted = [...clips].sort((a, b) => b.score - a.score);

  const selected = [];

  for (const clip of sorted) {
    if (selected.length >= clipCount) break;

    const overlaps = selected.some(sel => {
      const distance = Math.abs(clip.start - sel.start);
      return distance < minGapSeconds;
    });

    if (!overlaps) {
      selected.push(clip);
    }
  }

  // 2️⃣ Fallback de segurança (nunca retorna vazio)
  if (selected.length === 0 && sorted.length > 0) {
    selected.push(sorted[0]);
  }

  return {
    finalClips: selected
  };
};
