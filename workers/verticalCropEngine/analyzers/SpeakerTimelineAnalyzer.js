module.exports = function SpeakerTimelineAnalyzer({
  clipTranscriptSegments,
  clipDuration
}) {
  if (!Array.isArray(clipTranscriptSegments)) {
    throw new Error('[SpeakerTimelineAnalyzer] clipTranscriptSegments inválido');
  }

  const speakerTimeline = [];
  let totalSpeechTime = 0;

  for (const segment of clipTranscriptSegments) {
    const start = segment.start;
    const end = segment.end;

    if (typeof start !== 'number' || typeof end !== 'number') continue;
    if (end <= start) continue;

    const duration = end - start;

    speakerTimeline.push({
      start,
      end,
      duration
    });

    totalSpeechTime += duration;
  }

  const speakingRatio =
    clipDuration > 0 ? totalSpeechTime / clipDuration : 0;

  return {
    speakerTimeline,
    totalSpeechTime,
    speakingRatio
  };
};
