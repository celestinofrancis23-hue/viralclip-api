/**
 * ClipExportBuilder
 * Empacota clipes finais para execução (FFmpeg / Render Worker)
 */

module.exports = function ClipExportBuilder({
  finalClips,
  videoSource,
  jobId = "test_job"
}) {
  if (!Array.isArray(finalClips) || finalClips.length === 0) {
    throw new Error("[ClipExportBuilder] finalClips inválido ou vazio");
  }

  if (!videoSource || typeof videoSource !== "string") {
    throw new Error("[ClipExportBuilder] videoSource inválido");
  }

  const clips = finalClips.map((clip, index) => {
    const start = Number(clip.start.toFixed(2));
    const end = Number(clip.end.toFixed(2));
    const duration = Number((end - start).toFixed(2));

    const outputFile = `clip_${index}.mp4`;

    const ffmpegCommand =
      `ffmpeg -y -ss ${start} -to ${end} -i "${videoSource}" ` +
      `-c:v libx264 -c:a aac "${outputFile}"`;

    return {
      index,
      start,
      end,
      duration,
      score: clip.score,
      outputFile,
      ffmpegCommand
    };
  });

  return {
    jobId,
    videoSource,
    clips
  };
};
