/**
 * Style Engine
 * Aplica estilos visuais às palavras (sem alterar tempo)
 */

module.exports = function StyleEngine({
  clipIndex,
  startTime,
  endTime,
  words,
}) {
  console.log(`🎨 [StyleEngine] Clip ${clipIndex}`);

  if (!Array.isArray(words)) {
    throw new Error(
      `[StyleEngine] words inválidos no clip ${clipIndex}`
    );
  }

  const captions = [];
  const MAX_WORDS_PER_BLOCK = 3;

  let buffer = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const blockStart = buffer[0].start;
    const blockEnd = buffer[buffer.length - 1].end;

    const styledWords = buffer.map((w, idx) => {
      const isLast = idx === buffer.length - 1;
      const isLong = w.word.length >= 6;
      const hasPunctuation = /[.!?]/.test(w.word);

      return {
        word: w.word,
        start: w.start,
        end: w.end,
        style: {
          bold: isLong,
          highlight: isLast || hasPunctuation,
          color: isLast ? "yellow" : "white",
          scale: isLast ? 1.15 : 1,
        },
      };
    });

    captions.push({
      start: Number(blockStart.toFixed(3)),
      end: Number(blockEnd.toFixed(3)),
      text: styledWords.map(w => w.word).join(" "),
      words: styledWords,
    });

    buffer = [];
  };

  for (const word of words) {
    buffer.push(word);

    if (buffer.length >= MAX_WORDS_PER_BLOCK) {
      flushBuffer();
    }
  }

  flushBuffer();

  console.log(
    `✨ Caption blocks criados: ${captions.length} (clip ${clipIndex})`
  );

  return {
    clipIndex,
    startTime,
    endTime,
    captions,
  };
};
