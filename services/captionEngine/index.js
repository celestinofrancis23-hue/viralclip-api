// services/captionEngine/index.js

// ===============================
// IMPORTS DOS WORKERS
// ===============================
const TranscriptSliceWorker = require('../../workers/TranscriptSliceWorker');
const WordSplitterWorker = require('../../workers/WordSplitterWorker');
const wordTimingNormalizer = require('../../workers/wordTimingNormalizer');
const WordCaseNormalizerWorker = require('../../workers/WordCaseNormalizerWorker');
const HighlightTimelineBuilder = require('../../workers/HighlightTimelineBuilder');
const CaptionLayoutBuilder = require('../../workers/captionLayoutBuilder');
const ASSSubtitleBuilder = require('../../workers/ASSSubtitleBuilder');
const BurnInWorker = require('../../workers/BurnInWorker');

// ===============================
// CAPTION ENGINE
// ===============================
module.exports = async function CaptionEngine(jobContract) {
  console.log('\n==============================');
  console.log('[CaptionEngine] START');
  console.log('==============================\n');

  if (!jobContract || typeof jobContract !== 'object') {
    throw new Error('[CaptionEngine] jobContract inválido');
  }

  const { jobId, jobDir, transcript, clips } = jobContract;

  if (!jobId) throw new Error('[CaptionEngine] jobId ausente');
  if (!jobDir) throw new Error('[CaptionEngine] jobDir ausente');
  if (!transcript || !Array.isArray(transcript.segments)) {
    throw new Error('[CaptionEngine] transcript inválido');
  }
  if (!Array.isArray(clips)) {
    throw new Error('[CaptionEngine] clips inválido');
  }

  console.log('[CaptionEngine] Contract OK');
  console.log('clips:', clips.length);

  const burnedClips = [];

  // ===============================
  // PIPELINE POR CLIP
  // ===============================
  for (const clip of clips) {
    console.log('\n--------------------------------');
    console.log('[CaptionEngine] PROCESSANDO CLIP', clip.clipIndex);
    console.log('--------------------------------\n');

    // 1. Slice transcript
    const slicedSegments = TranscriptSliceWorker({
      transcriptSegments: transcript.segments,
      startTime: clip.startTime,
      endTime: clip.endTime,
    });

    // 2. Split words
    const words = WordSplitterWorker({
      jobId,
      clipIndex: clip.clipIndex,
      segments: slicedSegments,
    });

    // 3. Normalize timing
const normalizedWords = wordTimingNormalizer(
  words,
  {
    clipStartTime: clip.startTime,
  }
);

    // 4. Normalize case
    const caseNormalizedWords = WordCaseNormalizerWorker({
      words: normalizedWords,
    });

    // 5. Highlight timeline
    const highlightTimeline = HighlightTimelineBuilder({
      words: caseNormalizedWords,
      clipIndex: clip.clipIndex,
      options: { highlightMode: 'word' },
    });

    // 6. Layout
    const captionLayouts = CaptionLayoutBuilder({
      words: caseNormalizedWords,
      clipIndex: clip.clipIndex,
      options: {
        maxWordsPerLine: 3,
        maxLines: 2,
      },
    });

    // 7. Build ASS
const assSubtitles = ASSSubtitleBuilder({
  layouts: captionLayouts,
  highlightTimeline,
  options: {
    fontName: 'Montserrat SemiBold',
    fontSize: 68,
    primaryColor: '&H00FFFFFF',
    highlightColor: '&H00FFFFFF',
  },
});

    // 8. Burn-in
    const burned = BurnInWorker({
      jobId,
      jobDir,
      clipIndex: clip.clipIndex,
      videoPath: clip.videoPath,
      assContent: assSubtitles,
      captionLayouts,
      options: {
        resolution: { w: 1080, h: 1920 },
      },
    });

    console.log('[BurnInWorker] output:', burned.outputVideoPath);

    burnedClips.push(burned);
  }

  console.log('\n==============================');
  console.log('[CaptionEngine] FINALIZADO');
  console.log('==============================\n');

  return burnedClips;
};
