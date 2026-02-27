// services/captionMerge.js

function CaptionMerge(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("CaptionMerge: payload inválido");
  }

  const { jobId, jobDir, transcript, verticalClips } = payload;

  // =========================
  // Validações básicas
  // =========================
  if (!jobId) {
    throw new Error("CaptionMerge: jobId ausente");
  }

  if (!jobDir) {
    throw new Error("CaptionMerge: jobDir ausente");
  }

  if (
    !transcript ||
    !Array.isArray(transcript.segments) ||
    transcript.segments.length === 0
  ) {
    throw new Error("CaptionMerge: transcript inválido");
  }

  if (!Array.isArray(verticalClips) || verticalClips.length === 0) {
    throw new Error("CaptionMerge: clips inválidos");
  }

  // =========================
  // Normalização dos clips
  // =========================
  const clips = verticalClips.map((clip, index) => {
    const { clipIndex, videoPath, startTime, endTime } = clip;

    if (typeof clipIndex !== "number") {
      throw new Error(`CaptionMerge: clipIndex inválido no clip ${index}`);
    }

    if (!videoPath) {
      throw new Error(`CaptionMerge: videoPath ausente no clip ${clipIndex}`);
    }

    if (typeof startTime !== "number" || typeof endTime !== "number") {
      throw new Error(
        `CaptionMerge: startTime/endTime inválidos no clip ${clipIndex}`
      );
    }

    if (endTime <= startTime) {
      throw new Error(
        `CaptionMerge: endTime <= startTime no clip ${clipIndex}`
      );
    }

    return {
      clipIndex,
      videoPath,
      startTime,
      endTime,
    };
  });

  // =========================
  // Payload FINAL
  // =========================
  return {
    jobId,
    jobDir,
    transcript,
    clips,
  };
}

module.exports = CaptionMerge;
