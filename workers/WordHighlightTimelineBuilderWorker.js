const { validateWords } = require('../shared/validation.utils');
const {
  createTimelineFrame
} = require('../contracts/caption/TimelineFrame.contract');

/**
 * WordHighlightTimelineBuilderWorker
 * Responsabilidade única:
 * - Criar a timeline de highlight (karaoke)
 */
module.exports = function WordHighlightTimelineBuilderWorker({ words }) {
  if (!Array.isArray(words)) {
    throw new Error('[WordHighlightTimelineBuilderWorker] words deve ser um array');
  }

  validateWords(words);

  if (words.length === 0) return [];

  const frames = [];
  let frameIndex = 0;

  for (let i = 0; i < words.length; i++) {
    const activeWord = words[i];

    const frameWords = words.map((w, idx) => ({
      wordIndex: w.wordIndex ?? idx,
      word: w.word,
      isActive: (w.wordIndex ?? idx) === (activeWord.wordIndex ?? i)
    }));

    frames.push(
      createTimelineFrame({
        clipIndex: activeWord.clipIndex,
        frameIndex,
        start: activeWord.start,
        end: activeWord.end,
        words: frameWords
      })
    );

    frameIndex++;
  }

  return frames;
};
