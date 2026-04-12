async function StyleWorker({ segments }) {
  const styled = segments.map((seg) => ({
    ...seg,
    words: seg.words.map((w) => ({
      ...w,
      style: buildWordStyle(w),
    })),
  }));

  return { segments: styled };
}

function buildWordStyle(word) {
  if (word.isHighlight) {
    return highlightStyle(word.score);
  }
  return normalStyle();
}

function normalStyle() {
  return {
    fontName:     "Montserrat",
    fontSize:     72,
    bold:         true,
    italic:       false,
    primaryColor: "&H00FFFFFF",
    outlineColor: "&H00000000",
    shadowColor:  "&H80000000",
    outline:      3,
    shadow:       2,
    animation:    null,
    scaleX:       100,
    scaleY:       100,
  };
}

function highlightStyle(score) {
  const color     = scoreToColor(score);
  const fontSize  = scoreFontSize(score);
  const animation = scoreAnimation(score);

  return {
    fontName:     "Montserrat",
    fontSize,
    bold:         true,
    italic:       false,
    primaryColor: color,
    outlineColor: "&H00000000",
    shadowColor:  "&H80000000",
    outline:      4,
    shadow:       3,
    animation,
    scaleX:       100,
    scaleY:       100,
  };
}

function scoreToColor(score) {
  if (score >= 8) return "&H00FFFF00";  // ciano brilhante
  if (score >= 6) return "&H000099FF";  // laranja vibrante
  if (score >= 4) return "&H0000FFFF";  // amarelo TikTok
  return "&H00FFFFFF";                  // branco
}

function scoreFontSize(score) {
  if (score >= 8) return 96;
  if (score >= 6) return 84;
  if (score >= 4) return 78;
  return 72;
}

function scoreAnimation(score) {
  if (score >= 8) {
    return {
      type:       "shake_scale",
      scaleFrom:  90,
      scaleTo:    115,
      durationMs: 120,
    };
  }
  if (score >= 6) {
    return {
      type:       "scale_pop",
      scaleFrom:  95,
      scaleTo:    108,
      durationMs: 100,
    };
  }
  if (score >= 4) {
    return {
      type:       "fade_in",
      durationMs: 80,
    };
  }
  return null;
}

const CAPTION_POSITION = {
  verticalPercent: 75,
  alignment:       2,
  marginV:         80,
};

const FONTS = {
  primary:  "Montserrat",
  fallback: "Arial",
};

module.exports = { StyleWorker, CAPTION_POSITION, FONTS };

