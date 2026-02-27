// workers/HighlightTimelineBuilderWorker.js

const { createTimelineFrame } = require('../contracts/caption/TimelineFrame.contract');

module.exports = function HighlightTimelineBuilderWorker({ words }) {
  return words.map(w =>
    createTimelineFrame({
      clipIndex: w.clipIndex,
      start: w.relativeStart,
      end: w.relativeEnd,
      activeWordIndex: w.index,
    })
  );
};	
