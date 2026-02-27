// workers/WordTimingNormalizerWorker.js

module.exports = function WordTimingNormalizerWorker({
  words,
  clipStartTime,
}) {
  console.log('\n[WordTimingNormalizer] INPUT');
  console.log('words count:', Array.isArray(words) ? words.length : 'INVALID');
  console.log('clipStartTime:', clipStartTime);

  if (!Array.isArray(words)) {
    throw new Error('[WordTimingNormalizer] words inválido (não é array)');
  }

  if (typeof clipStartTime !== 'number') {
    throw new Error('[WordTimingNormalizer] clipStartTime inválido');
  }

  const normalized = words.map((word, i) => {
    if (
      typeof word.start !== 'number' ||
      typeof word.end !== 'number'
    ) {
      throw new Error(`[WordTimingNormalizer] start/end inválidos na word ${i}`);
    }

    const start = Math.max(0, word.start);
    const end = Math.max(start + 0.001, word.end);

    const relativeStart = Math.max(0, start);
    const relativeEnd = Math.max(relativeStart + 0.001, end);

    return {
      index: word.index,
      word: word.word,
      start,
      end,
      relativeStart,
      relativeEnd,
      clipIndex: word.clipIndex,
    };
  });

  console.log('[WordTimingNormalizer] OUTPUT');
  console.log('normalized count:', normalized.length);
  console.log('sample normalized:', normalized[0]);

  return normalized;
};
