// workers/WordSplitterWorker.js

module.exports = function WordSplitterWorker({
  jobId,
  clipIndex,
  segments
}) {
  console.log('\n[WordSplitterWorker] INPUT');
  console.log('jobId:', jobId);
  console.log('clipIndex:', clipIndex);
  console.log('segments count:', segments?.length);

  if (!jobId) {
    throw new Error('[WordSplitterWorker] jobId ausente');
  }

  if (typeof clipIndex !== 'number') {
    throw new Error('[WordSplitterWorker] clipIndex inválido');
  }

  if (!Array.isArray(segments)) {
    throw new Error('[WordSplitterWorker] segments inválido (não é array)');
  }

  const words = [];

  segments.forEach((segment, segmentIndex) => {
    if (!segment.text || typeof segment.start !== 'number' || typeof segment.end !== 'number') {
      throw new Error('[WordSplitterWorker] segmento inválido');
    }

    const rawWords = segment.text.trim().split(/\s+/);
    const duration = segment.end - segment.start;

    if (duration <= 0 || rawWords.length === 0) return;

    const wordDuration = duration / rawWords.length;

    rawWords.forEach((word, wordIndex) => {
      const start = segment.start + wordIndex * wordDuration;
      const end = start + wordDuration;

      words.push({
        word,
        start,
        end,
        clipIndex,
        segmentIndex,
        wordIndex
      });
    });
  });

  console.log('[WordSplitterWorker] OUTPUT');
  console.log('words count:', words.length);
  console.log('sample word:', words[0]);

  return words;
};
