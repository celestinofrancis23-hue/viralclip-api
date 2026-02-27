function buildSafeVerticalSegments({
  moments,
  inputWidth,
  inputHeight,
  clipStart,
  clipEnd,
}) {
  if (!Array.isArray(moments)) return [];

  const segments = [];

  for (const m of moments) {
    const start = Math.max(m.start, clipStart);
    const end = Math.min(m.end, clipEnd);

    if (end <= start) continue;

    segments.push({
      start,
      end,
      crop: {
        x: 0,
        y: 0,
        w: inputWidth,
        h: inputHeight,
      },
    });
  }

  return segments;
}

module.exports = buildSafeVerticalSegments;
