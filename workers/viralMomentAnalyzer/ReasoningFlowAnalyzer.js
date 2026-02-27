module.exports = function ReasoningFlowAnalyzer({ segments }) {
  if (!segments || !segments.length) {
    throw new Error("[ReasoningFlowAnalyzer] Segments inválidos");
  }

  const MAX_GAP = 1.2;
  const MAX_DURATION = 45;

  const blocks = [];
  let current = null;

  segments.forEach((seg, index) => {
    if (!current) {
      current = {
        id: 0,
        start: seg.start,
        end: seg.end,
        duration: seg.duration,
        text: seg.text,
        segmentIds: [seg.id],
      };
      return;
    }

    const gap = seg.start - current.end;
    const endsStrong = /[.!?]$/.test(current.text.trim());

    if (
      gap <= MAX_GAP &&
      !endsStrong &&
      current.duration + seg.duration <= MAX_DURATION
    ) {
      current.end = seg.end;
      current.duration += seg.duration;
      current.text += " " + seg.text;
      current.segmentIds.push(seg.id);
    } else {
      blocks.push(current);
      current = {
        id: blocks.length,
        start: seg.start,
        end: seg.end,
        duration: seg.duration,
        text: seg.text,
        segmentIds: [seg.id],
      };
    }
  });

  if (current) blocks.push(current);

  // Confidence simples V1
  blocks.forEach(b => {
    b.confidence = Math.min(1, b.duration / 20);
  });

  return {
    reasoningBlocks: blocks,
    metadata: {
      totalBlocks: blocks.length
    }
  };
};
