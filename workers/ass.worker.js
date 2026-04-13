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
Style: Normal,Montserrat,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,5,40,40,0,1

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

  const words = seg.words || [];
  if (words.length === 0) return null;

  // Linha 1 (branca, fs52): primeiras até 3 palavras
  const line1Text = words.slice(0, 3)
    .map(w => (w.word || "") + (w.punctuation || ""))
    .join(" ")
    .trim();

  // Linha 2 (ciano #00BFFF, fs72): palavras 4-6
  const line2Text = words.slice(3, 6)
    .map(w => (w.word || "") + (w.punctuation || ""))
    .join(" ")
    .trim();

  // \an5\pos(540,960) = centro exacto do frame 1080×1920
  let body;
  if (line1Text && line2Text) {
    body = `{\\fs52\\c&H00FFFFFF&}${line1Text}\\N{\\fs72\\c&H00FFBF00&}${line2Text}`;
  } else {
    // Segmento curto: só linha ciano
    body = `{\\fs72\\c&H00FFBF00&}${line1Text || line2Text}`;
  }

  const text = `{\\an5\\pos(540,960)}${body}`;
  return `Dialogue: 0,${start},${end},Normal,,0,0,0,,${text}`;
}

function formatAssTime(seconds) {
  const h  = Math.floor(seconds / 3600);
  const m  = Math.floor((seconds % 3600) / 60);
  const s  = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);

  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

module.exports = { AssWorker };

