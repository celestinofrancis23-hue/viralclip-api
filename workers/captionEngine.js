// captionEngine.js
// PURE ENGINE — no IO, no FS, no jobs

function buildCaptionsFromWords({
  words,
  clipStart,
  clipEnd,
  options = {}
}) {
  const {
    maxWordsPerLine = 7,
    pauseThreshold = 0.4
  } = options;

  if (!Array.isArray(words) || words.length === 0) {
    return [];
  }

  // 1️⃣ Filter words that intersect the clip window
  const clipWords = words.filter(w =>
    w.end > clipStart && w.start < clipEnd
  );

  if (clipWords.length === 0) {
    return [];
  }

  // 2️⃣ Normalize time to clip
  const normalizedWords = clipWords.map(w => ({
    word: w.word,
    start: Math.max(0, w.start - clipStart),
    end: Math.min(clipEnd - clipStart, w.end - clipStart)
  }));

  // 3️⃣ Group words into caption blocks
  const captions = [];
  let buffer = [];

  function flushBuffer() {
    if (buffer.length === 0) return;

    captions.push({
      start: buffer[0].start,
      end: buffer[buffer.length - 1].end,
      text: buffer.map(w => w.word).join(' '),
      words: buffer
    });

    buffer = [];
  }

  for (let i = 0; i < normalizedWords.length; i++) {
    const current = normalizedWords[i];
    const prev = buffer[buffer.length - 1];

    const pause =
      prev && current.start - prev.end >= pauseThreshold;

    const tooManyWords =
      buffer.length >= maxWordsPerLine;

    if (pause || tooManyWords) {
      flushBuffer();
    }

    buffer.push(current);
  }

  flushBuffer();

  return captions;
}

module.exports = {
  buildCaptionsFromWords
};
