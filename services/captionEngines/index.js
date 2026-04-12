// CaptionEngine/index.js
// Orquestrador principal — encadeia todos os workers em sequência

import { NormalizerWorker } from “./workers/normalizer.worker.js”;
import { HighlightWorker } from “./workers/highlight.worker.js”;
import { StyleWorker } from “./workers/style.worker.js”;
import { AssWorker } from “./workers/ass.worker.js”;
import { RenderWorker } from “./workers/render.worker.js”;

/**

- CaptionEngine
- Recebe o payload do pipeline principal e retorna array de clipes com legenda queimada
- 
- @param {object} payload
- @param {string} payload.jobId
- @param {string} payload.jobDir
- @param {string} payload.userId
- @param {object} payload.transcript        - { segments: [{start, end, text}] }
- @param {Array}  payload.verticalClips     - [{ clipIndex, videoPath, startTime, endTime }]
- @returns {Array} clipes finais com legenda [ { clipIndex, videoPath, startTime, endTime } ]
  */
  export async function CaptionEngine(payload) {
  const { jobId, jobDir, userId, transcript, verticalClips } = payload;

if (!Array.isArray(verticalClips) || verticalClips.length === 0) {
throw new Error(“CaptionEngine: verticalClips está vazio ou inválido”);
}

if (!transcript?.segments?.length) {
throw new Error(“CaptionEngine: transcript inválido ou sem segmentos”);
}

console.log(`\n🎬 CaptionEngine iniciada — Job: ${jobId}`);
console.log(`   ${verticalClips.length} clipe(s) para processar`);

const results = [];

for (const clip of verticalClips) {
console.log(`\n   ▶ Clipe ${clip.clipIndex} — ${clip.videoPath}`);

```
try {
  // ── WORKER 1: Normaliza e alinha o transcript com o clipe ──────────────
  const normalized = await NormalizerWorker({
    clip,
    transcript,
    jobDir,
  });

  // ── WORKER 2: Detecta palavras fortes via heurística ───────────────────
  const highlighted = await HighlightWorker({
    clip,
    segments: normalized.segments,
    jobDir,
  });

  // ── WORKER 3: Aplica estilo visual TikTok ──────────────────────────────
  const styled = await StyleWorker({
    clip,
    segments: highlighted.segments,
    jobDir,
  });

  // ── WORKER 4: Gera arquivo .ASS com animações ──────────────────────────
  const assFile = await AssWorker({
    clip,
    segments: styled.segments,
    jobDir,
  });

  // ── WORKER 5: Queima legenda no vídeo via FFmpeg ───────────────────────
  const rendered = await RenderWorker({
    clip,
    assPath: assFile.assPath,
    jobDir,
  });

  results.push({
    clipIndex: clip.clipIndex,
    videoPath: rendered.outputPath,
    startTime: clip.startTime,
    endTime: clip.endTime,
  });

  console.log(`   ✅ Clipe ${clip.clipIndex} concluído → ${rendered.outputPath}`);
} catch (err) {
  console.error(`   ❌ Erro no clipe ${clip.clipIndex}:`, err.message);
  throw err;
}
```

}

console.log(`\n✅ CaptionEngine finalizada — ${results.length} clipe(s) gerados`);
return results;
}
