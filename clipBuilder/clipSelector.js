// clipBuilder/clipSelector.js

module.exports = async function clipSelector({
  moments,
  transcript,
  job,
  jobDir
}) {
  console.log("🎬 [ClipSelector] Iniciando seleção de clipes...");

  if (!Array.isArray(moments) || moments.length === 0) {
    throw new Error("Nenhum momento disponível para seleção");
  }

  const clipLength = job.settings?.clipLength || 30;
  const clipCount = job.settings?.clipCount || 5;

  // 1️⃣ Ordenar por score (desc)
  const sortedMoments = [...moments].sort((a, b) => b.score - a.score);

  const selectedClips = [];
  let clipIndex = 1;

  for (const moment of sortedMoments) {
    if (selectedClips.length >= clipCount) break;

    const center = (moment.start + moment.end) / 2;

    const start = Math.max(0, center - clipLength / 2);
    const end = start + clipLength;

    // 2️⃣ Evitar sobreposição com clipes já escolhidos
    const overlaps = selectedClips.some(c =>
      !(end <= c.start || start >= c.end)
    );

    if (overlaps) continue;

    selectedClips.push({
      clipId: `clip_${clipIndex.toString().padStart(2, "0")}`,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      duration: clipLength,
      score: moment.score,
      reason: moment.reasons,
      sourceMoment: {
        start: moment.start,
        end: moment.end
      }
    });

    console.log(
      `✅ Clip selecionado: clip_${clipIndex} (${start.toFixed(
        1
      )}s → ${end.toFixed(1)}s)`
    );

    clipIndex++;
  }

  if (selectedClips.length === 0) {
    throw new Error("Nenhum clipe válido após seleção");
  }

  console.log(
    `🎯 [ClipSelector] ${selectedClips.length} clipes prontos para corte`
  );

  return {
    clipLength,
    totalMoments: moments.length,
    selectedClips
  };
};
