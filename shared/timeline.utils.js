function createTimelineFrame({
  start,
  end,
  word,
  clipIndex,
}) {
  return {
    type: "word-highlight",
    start,
    end,
    payload: {
      word,
      clipIndex,
    },
  };
}

module.exports = {
  createTimelineFrame,
};
