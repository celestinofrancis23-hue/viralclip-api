// engines/captionEngine.js

function captionEngine({ transcriptWords, windowStart, windowEnd }) {
  if (!Array.isArray(transcriptWords)) {
    throw new Error("transcriptWords inválido");
  }

  const slicedWords = transcriptWords.filter(word => {
    return (
      word.start >= windowStart &&
      word.end <= windowEnd
    );
  });

  return slicedWords;
}

module.exports = captionEngine;

