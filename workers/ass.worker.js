const fs   = require("fs");
const path = require("path");
const { CAPTION_POSITION } = require("./style.worker");

async function AssWorker({ clip, segments, jobDir }) {
  const W = 1080;
  const H = 1920;

  const assPath = path.join(jobDir, `caption_${clip.clipIndex}.ass`);

  if (!segments.length) {
    fs.writeFileSync(assPath, buildAssHeader(W, H), "utf-8");
    return { assPath };
  }

  const header = buildAssHeader(W, H);
  const events = buildAssEvents(segments);

  fs.writeFileSync(assPath, header + events, "utf-8");
  console.log(`      📄 ASS gerado: ${path.basename(assPath)}`);

  return { assPath };
}

function buildAssHeader(width, height) {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Normal,Montserrat,80,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,5,40,40,0,1
Style: Highlight,Montserrat,90,&H00FFBF00,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,2,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

function buildAssEvents(segments) {
  return segments.map((seg) => buildSegmentLine(seg)).join("\n") + "\n";
}

function buildSegmentLine(seg) {
  const start = formatAssTime(seg.start);
  const end   = formatAssTime(seg.end);

  // Agrupar em linhas de máx 3 palavras, máx 2 linhas
  const lines = [];
  for (let i = 0; i < seg.words.length; i += 3) {
    const chunk = seg.words.slice(i, i + 3);
    lines.push(chunk.map((w) => buildWordTags(w)).join(" "));
  }

  // \an5 = centro (horizontal+vertical), \pos(540,960) = centro do frame 1080×1920
  const text = "{\\an5\\pos(540,960)}" + lines.join("\\N");

  return `Dialogue: 0,${start},${end},Normal,,0,0,0,,${text}`;
}

function buildWordTags(word) {
  const s    = word.style;
  const tags = [];

  tags.push(`\\c${s.primaryColor}&`);
  tags.push(`\\fs${s.fontSize}`);
  if (s.bold) tags.push("\\b1");

  if (s.animation) {
    const anim = buildAnimationTag(s.animation);
    if (anim) tags.push(anim);
  }

  const openTag  = tags.length ? `{${tags.join("")}}` : "";
  const closeTag = "{\\r}";
  const wordText = word.word + (word.punctuation || "");

  return `${openTag}${wordText}${closeTag}`;
}

function buildAnimationTag(animation) {
  const { type, durationMs, scaleFrom, scaleTo } = animation;

  switch (type) {
    case "shake_scale":
      return (
        `\\t(0,${durationMs},\\fscx${scaleTo}\\fscy${scaleTo})` +
        `\\t(${durationMs},${durationMs * 2},\\fscx${scaleFrom}\\fscy${scaleFrom})`
      );
    case "scale_pop":
      return `\\t(0,${durationMs},\\fscx${scaleTo}\\fscy${scaleTo})\\t(${durationMs},${durationMs * 2},\\fscx100\\fscy100)`;
    case "fade_in":
      return `\\fad(${durationMs},0)`;
    default:
      return null;
  }
}

function formatAssTime(seconds) {
  const h  = Math.floor(seconds / 3600);
  const m  = Math.floor((seconds % 3600) / 60);
  const s  = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);

  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

module.exports = { AssWorker };

