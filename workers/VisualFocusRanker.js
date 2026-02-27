function VisualFocusRanker({
  clipDuration,
  speakerTimeline = [],
  faceAnalysis = {},
  motionAnalysis = {}
}) {
  const focusTimeline = [];

  // 1️⃣ Speaker + Face dominante
  speakerTimeline.forEach(segment => {
    focusTimeline.push({
      start: segment.start,
      end: segment.end,
      focusType: 'speaker_face',
      targetFaceId: faceAnalysis.dominantFaceId || null,
      weight: 0.9
    });
  });

  // 2️⃣ Só rosto dominante
  if (focusTimeline.length === 0 && faceAnalysis.dominantFaceId) {
    focusTimeline.push({
      start: 0,
      end: clipDuration,
      focusType: 'face',
      targetFaceId: faceAnalysis.dominantFaceId,
      weight: 0.75
    });
  }

  // 3️⃣ Movimento
  if (
    focusTimeline.length === 0 &&
    motionAnalysis.motionRegions &&
    motionAnalysis.motionRegions.length
  ) {
    motionAnalysis.motionRegions.forEach(region => {
      focusTimeline.push({
        start: region.start,
        end: region.end,
        focusType: 'motion',
        region: region.region,
        weight: region.energyScore || 0.6
      });
    });
  }

  // 4️⃣ Fallback
  if (focusTimeline.length === 0) {
    focusTimeline.push({
      start: 0,
      end: clipDuration,
      focusType: 'center',
      weight: 0.3
    });
  }

  return {
    focusTimeline,
    dominantStrategy: focusTimeline[0].focusType
  };
}

module.exports = VisualFocusRanker;
