// workers/CaptionLayoutBuilderWorker.js

module.exports = function CaptionLayoutBuilderWorker({ timeline }) {
  return timeline.map(frame => ({
    ...frame,
    style: 'karaoke',
  }));
};
