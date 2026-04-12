const { NormalizerWorker } = require("../../workers/normalizer.worker");
const { HighlightWorker }  = require("../../workers/highlight.worker");
const { StyleWorker }      = require("../../workers/style.worker");
const { AssWorker }        = require("../../workers/ass.worker");
const { RenderWorker }     = require("../../workers/render.worker");


async function CaptionEngine(payload) {
  const { jobId, jobDir, userId, transcript, verticalClips } = payload;

  if (!Array.isArray(verticalClips) || verticalClips.length === 0) {
    throw new Error("CaptionEngine: verticalClips está vazio ou inválido");
  }

  if (!transcript?.segments?.length) {
    throw new Error("CaptionEngine: transcript inválido ou sem segmentos");
  }

  console.log(`\n🎬 CaptionEngine iniciada — Job: ${jobId}`);
  console.log(`   ${verticalClips.length} clipe(s) para processar`);

  const results = [];

  for (const clip of verticalClips) {
    console.log(`\n   ▶ Clipe ${clip.clipIndex} — ${clip.videoPath}`);

    try {
      const normalized = await NormalizerWorker({ clip, transcript, jobDir });
      const highlighted = await HighlightWorker({ clip, segments: normalized.segments, jobDir });
      const styled = await StyleWorker({ clip, segments: highlighted.segments, jobDir });
      const assFile = await AssWorker({ clip, segments: styled.segments, jobDir });
      const rendered = await RenderWorker({ clip, assPath: assFile.assPath, jobDir });

      results.push({
        clipIndex: clip.clipIndex,
        videoPath: rendered.outputPath,
        startTime: clip.startTime,
        endTime:   clip.endTime,
      });

      console.log(`   ✅ Clipe ${clip.clipIndex} concluído → ${rendered.outputPath}`);
    } catch (err) {
      console.error(`   ❌ Erro no clipe ${clip.clipIndex}:`, err.message);
      throw err;
    }
  }

  console.log(`\n✅ CaptionEngine finalizada — ${results.length} clipe(s) gerados`);
  return results;
}

module.exports = { CaptionEngine };

