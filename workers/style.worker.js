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
    fontSize:     80,
    bold:         true,
    italic:       false,
    primaryColor: "&H00FFFFFF",  // branco
    outlineColor: "&H00000000",  // contorno preto
    shadowColor:  "&H80000000",
    outline:      4,
    shadow:       2,
    animation:    null,
    scaleX:       100,
    scaleY:       100,
  };
}

function highlightStyle(score) {
  return {
    fontName:     "Montserrat",
    fontSize:     90,
    bold:         true,
    italic:       false,
    primaryColor: "&H00FFBF00",  // ciano #00BFFF (estilo viral Shorts)
    outlineColor: "&H00000000",  // contorno preto
    shadowColor:  "&H80000000",
    outline:      5,
    shadow:       2,
    animation:    scoreAnimation(score),
    scaleX:       100,
    scaleY:       100,
  };
}

function scoreAnimation(score) {
  if (score >= 6) {
    return {
      type:       "scale_pop",
      scaleFrom:  95,
      scaleTo:    108,
      durationMs: 100,
    };
  }
  return null;
}

const CAPTION_POSITION = {
  alignment: 5,  // centro (horizontal + vertical)
  marginV:   0,
};

const FONTS = {
  primary:  "Montserrat",
  fallback: "Arial",
};

module.exports = { StyleWorker, CAPTION_POSITION, FONTS };

