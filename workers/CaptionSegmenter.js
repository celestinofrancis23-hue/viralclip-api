// workers/CaptionSegmenter.js
// Segmenta captions para estilo Reels / TikTok (2 linhas, texto curto)

module.exports = function CaptionSegmenter({
  normalizedCaptions,
  maxCharsPerLine = 22,
  maxLines = 2,
}) {
  if (!Array.isArray(normalizedCaptions)) {
    throw new Error('[CaptionSegmenter] normalizedCaptions deve ser um array');
  }

  const segments = [];

  for (const cap of normalizedCaptions) {
    if (
      !cap ||
      typeof cap.text !== 'string' ||
      typeof cap.start !== 'number' ||
      typeof cap.end !== 'number'
    ) {
      continue; // ignora captions inválidas sem quebrar
    }

    const words = cap.text.trim().split(/\s+/);
    let currentLines = [];
    let currentLine = '';
    let segmentStart = cap.start;

    const flushSegment = (segmentEnd) => {
      if (currentLines.length === 0) return;

      segments.push({
        start: segmentStart,
        end: segmentEnd,
        lines: [...currentLines],
        text: currentLines.join('\n'),
      });

      currentLines = [];
      currentLine = '';
      segmentStart = segmentEnd;
    };

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine
        ? `${currentLine} ${word}`
        : word;

      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        currentLines.push(currentLine);
        currentLine = word;

        if (currentLines.length === maxLines) {
          const progress = i / words.length;
          const segmentEnd =
            cap.start + (cap.end - cap.start) * progress;

          flushSegment(segmentEnd);
        }
      }
    }

    if (currentLine) {
      currentLines.push(currentLine);
    }

    flushSegment(cap.end);
  }

  console.log(
    `🧩 CaptionSegmenter: ${segments.length} segmentos criados`
  );

  return segments;
};
