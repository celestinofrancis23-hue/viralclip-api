// contracts/caption/TimelineFrame.contract.js

function createTimelineFrame({
  clipIndex,
  start,
  end,
  activeWordIndex,
}) {
  return {
    clipIndex,
    start,
    end,
    activeWordIndex,
  };
}

module.exports = { createTimelineFrame };

