// contracts/caption/WordHighlightTimeline.contract.js

/**
 * WordHighlightTimeline Contract
 * ------------------------------
 * Representa uma sequência ordenada de frames
 * onde cada frame indica quais palavras estão ativas (highlight)
 * em um intervalo de tempo.
 */

const WordHighlightTimelineContract = {
  /**
   * Lista ordenada de frames de highlight
   */
  frames: "TimelineFrame[]"
};

module.exports = WordHighlightTimelineContract;

