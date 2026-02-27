// workers/ViralMomentAnalyzer/ClipAssembler.js

module.exports = function ClipAssembler({
  candidateSeeds,
  clipLength
}) {
  if (!Array.isArray(candidateSeeds)) {
    throw new Error('[ClipAssembler] candidateSeeds inválido');
  }

  if (typeof clipLength !== 'number' || clipLength <= 0) {
    throw new Error('[ClipAssembler] clipLength inválido');
  }

  const clips = candidateSeeds.map((seed, index) => {
    const start = seed.seedStart;
    const end = start + clipLength;

    return {
      id: index,
      start,
      end,
      duration: clipLength,
      score: seed.score,
      reason: seed.reason,
      sourceSeed: seed
    };
  });

  return {
    clips
  };
};
