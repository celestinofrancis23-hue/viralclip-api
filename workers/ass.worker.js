// CaptionEngine/workers/ass.worker.js
// Gera o arquivo .ASS (Advanced SubStation Alpha) com estilos e animações
// O .ASS é o formato mais rico suportado pelo FFmpeg para legendas

import fs from “fs”;
import path from “path”;
import { CAPTION_POSITION } from “./style.worker.js”;

/**

- @param {object} params
- @param {object} params.clip
- @param {Array}  params.segments - segmentos com estilo aplicado
- @param {string} params.jobDir
- @returns {{ assPath: string }}
  */
  export async function AssWorker({ clip, segments, jobDir }) {
  if (!segments.length) {
  // Gera ASS vazio para não quebrar o pipeline
  const assPath = path.join(jobDir, `caption_${clip.clipIndex}.ass`);
  fs.writeFileSync(assPath, buildAssHeader(1080, 1920), “utf-8”);
  return { assPath };
  }

// Dimensões do vídeo vertical (9:16)
const W = 1080;
const H = 1920;

const header = buildAssHeader(W, H);
const events = buildAssEvents(segments);

const assContent = header + events;
const assPath = path.join(jobDir, `caption_${clip.clipIndex}.ass`);

fs.writeFileSync(assPath, assContent, “utf-8”);
console.log(`      📄 ASS gerado: ${path.basename(assPath)}`);

return { assPath };
}

// ─── Header do arquivo .ASS ───────────────────────────────────────────────────

function buildAssHeader(width, height) {
return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Normal,Montserrat,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,40,40,${CAPTION_POSITION.marginV},1
Style: Highlight,Montserrat,84,&H0000FFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,3,2,40,40,${CAPTION_POSITION.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

// ─── Eventos (linhas de legenda) ──────────────────────────────────────────────

function buildAssEvents(segments) {
const lines = [];

for (const seg of segments) {
// Renderiza a linha inteira do segmento como um evento
// com cada palavra estilizada individualmente via override tags
const line = buildSegmentLine(seg);
lines.push(line);
}

return lines.join(”\n”) + “\n”;
}

/**

- Constrói uma linha ASS para um segmento inteiro
- Usa tags {\k} para karaoke (palavra a palavra) e {\c} para cor individual
  */
  function buildSegmentLine(seg) {
  const start = formatAssTime(seg.start);
  const end   = formatAssTime(seg.end);

// Constrói o texto com tags de override por palavra
const textParts = seg.words.map((w) => buildWordTags(w, seg));
const text = textParts.join(” “);

// Usa estilo base Normal (os overrides ficam inline)
return `Dialogue: 0,${start},${end},Normal,,0,0,0,,${text}`;
}

/**

- Gera as tags ASS para uma única palavra
- Ex: {\c&H0000FFFF&\fs84\t(\fscx115\fscy115)}DEUS{\r}
  */
  function buildWordTags(word, seg) {
  const s = word.style;
  const tags = [];

// Cor
tags.push(`\\c${s.primaryColor}&`);

// Tamanho da fonte
tags.push(`\\fs${s.fontSize}`);

// Bold
if (s.bold) tags.push(”\b1”);

// Animação
if (s.animation) {
const anim = buildAnimationTag(s.animation, s.fontSize);
if (anim) tags.push(anim);
}

const openTag  = tags.length ? `{${tags.join("")}}` : “”;
const closeTag = “{\r}”; // reset para o próximo

const wordText = word.word + (word.punctuation || “”);

return `${openTag}${wordText}${closeTag}`;
}

/**

- Gera a tag \t() de animação ASS
  */
  function buildAnimationTag(animation, baseFontSize) {
  const { type, durationMs, scaleFrom, scaleTo } = animation;

switch (type) {
case “shake_scale”:
// Escala de scaleFrom% → scaleTo% → scaleFrom% (efeito shake)
return (
`\\t(0,${durationMs},\\fscx${scaleTo}\\fscy${scaleTo})` +
`\\t(${durationMs},${durationMs * 2},\\fscx${scaleFrom}\\fscy${scaleFrom})`
);

```
case "scale_pop":
  // Pop suave: cresce e volta
  return `\\t(0,${durationMs},\\fscx${scaleTo}\\fscy${scaleTo})\\t(${durationMs},${durationMs * 2},\\fscx100\\fscy100)`;

case "fade_in":
  // Fade in rápido
  return `\\fad(${durationMs},0)`;

default:
  return null;
```

}
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

/**

- Converte segundos para o formato de tempo ASS: H:MM:SS.cc
  */
  function formatAssTime(seconds) {
  const h   = Math.floor(seconds / 3600);
  const m   = Math.floor((seconds % 3600) / 60);
  const s   = Math.floor(seconds % 60);
  const cs  = Math.round((seconds % 1) * 100); // centisegundos

return (
`${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`
);
}
