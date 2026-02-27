function FaceDominanceAnalyzer({ frames }) {
  const faceBuckets = [];

  for (const frame of frames) {
    for (const face of frame.faces) {
      const cx = face.x + face.w / 2;
      const cy = face.y + face.h / 2;

      let bucket = faceBuckets.find(b =>
        Math.abs(b.cx - cx) < face.w * 0.5 &&
        Math.abs(b.cy - cy) < face.h * 0.5
      );

      if (!bucket) {
        bucket = {
          cx,
          cy,
          totalArea: 0,
          totalConfidence: 0,
          count: 0,
          samples: []
        };
        faceBuckets.push(bucket);
      }

      bucket.totalArea += face.w * face.h;
      bucket.totalConfidence += face.confidence;
      bucket.count += 1;
      bucket.samples.push(face);
    }
  }

  if (faceBuckets.length === 0) {
    throw new Error("No faces found for dominance analysis");
  }

  const dominant = faceBuckets.reduce((best, current) => {
    const bestScore =
      (best.totalArea / best.count) *
      best.count *
      (best.totalConfidence / best.count);

    const currentScore =
      (current.totalArea / current.count) *
      current.count *
      (current.totalConfidence / current.count);

    return currentScore > bestScore ? current : best;
  });

  // média final do rosto dominante
  const avg = dominant.samples.reduce(
    (acc, f) => {
      acc.x += f.x;
      acc.y += f.y;
      acc.w += f.w;
      acc.h += f.h;
      return acc;
    },
    { x: 0, y: 0, w: 0, h: 0 }
  );

  const n = dominant.samples.length;

  return {
    dominantFace: {
      x: Math.round(avg.x / n),
      y: Math.round(avg.y / n),
      w: Math.round(avg.w / n),
      h: Math.round(avg.h / n)
    }
  };
}

module.exports = FaceDominanceAnalyzer;
