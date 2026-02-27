// workers/ASSSubtitleBuilder.js

module.exports = function ASSSubtitleBuilder({
  layouts,
  highlightTimeline,
  options = {},
}) {
  if (!Array.isArray(layouts)) {
    throw new Error("[ASSSubtitleBuilder] layouts inválido");
  }

  const {
    fontName = "Montserrat SemiBold",
    fontSize = 68,
    primaryColor = "&H00FFFFFF",
    highlightColor = "&H0000FFFF",
  } = options;

  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const sec = Math.floor(s);
    const ms = Math.floor((s - sec) * 100);
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(
      2,
      "0"
    )}.${String(ms).padStart(2, "0")}`;
  }

  let ass = `
[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,${fontName},${fontSize},${primaryColor},${highlightColor},&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,0,2,40,40,350,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
`;

  for (const block of layouts) {
    const start = formatTime(block.start);
    const end = formatTime(block.end);

    let blockText = "";

    for (const line of block.lines) {
      const lineText = line.words.map(w => w.text).join(" ");
      blockText += lineText + "\\N";
    }

    ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${blockText.trim()}\n`;
  }

  return ass;
};
