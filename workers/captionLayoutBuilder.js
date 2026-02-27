// workers/CaptionLayoutBuilder.js

module.exports = function CaptionLayoutBuilder({
  words,
  clipIndex,
  options = {}
}) {
  const maxWordsPerLine = options.maxWordsPerLine || 3;
  const maxLines = options.maxLines || 2;

  console.log('[CaptionLayoutBuilder] INPUT');
  console.log('words:', words.length);
  console.log('clipIndex:', clipIndex);

  const blocks = [];
  let currentWords = [];
  let currentLines = [];

  function flushBlock() {
    if (currentLines.length === 0) return;

    const start = currentLines[0].words[0].start;
    const end =
      currentLines[currentLines.length - 1].words.slice(-1)[0].end;

    blocks.push({
      start,
      end,
      clipIndex,
      lines: currentLines,
    });

    currentLines = [];
  }

  for (const word of words) {
    currentWords.push(word);

    if (currentWords.length === maxWordsPerLine) {
      currentLines.push({
        text: currentWords.map(w => w.word).join(' '),
        words: currentWords,
      });
      currentWords = [];
    }

    if (currentLines.length === maxLines) {
      flushBlock();
    }
  }

  // Restos
  if (currentWords.length) {
    currentLines.push({
      text: currentWords.map(w => w.word).join(' '),
      words: currentWords,
    });
  }

  flushBlock();

  console.log('[CaptionLayoutBuilder] OUTPUT');
  console.log('blocks:', blocks.length);
  console.log('sample:', blocks[0]);

  return blocks;
};
