const fs = require("fs");
const path = require("path");

/**
 * Merge Worker (ORQUESTRADOR DE MERGE)
 *
 * Responsabilidade:
 * - localizar vertical clips por jobId
 * - localizar captions RAW por jobId
 * - validar pares (clip + caption)
 * - criar plano de merge por clip
 * - RETORNAR lista estruturada para Burn-in
 *
 * NÃO usa FFmpeg
 * NÃO queima legenda
 * NÃO gera vídeo final
 */
async function mergeWorker({ jobId }) {
  if (!jobId) {
    throw new Error("mergeWorker: jobId ausente");
  }

  console.log("🧩 Merge Worker iniciado:", jobId);

  // ==============================
  // Diretórios base
  // ==============================
  const verticalDir = path.resolve(
    "vertical_clips",
    jobId
  );

  const captionsDir = path.resolve(
    "captions",
    "raw",
    jobId
  );

  const mergeQueueDir = path.resolve(
    "merge",
    "queue",
    jobId
  );

  fs.mkdirSync(mergeQueueDir, { recursive: true });

  console.log("📁 Diretórios OK");
  console.log(" vertical:", verticalDir);
  console.log(" captions:", captionsDir);
  console.log(" merge:", mergeQueueDir);

  // ==============================
  // Validações de existência
  // ==============================
  if (!fs.existsSync(verticalDir)) {
    throw new Error("mergeWorker: diretório de vertical clips não encontrado");
  }

  if (!fs.existsSync(captionsDir)) {
    throw new Error("mergeWorker: diretório de captions RAW não encontrado");
  }

  // ==============================
  // Leitura de arquivos
  // ==============================
  const verticalFiles = fs
    .readdirSync(verticalDir)
    .filter((f) => f.endsWith(".mp4"))
    .sort();

  const captionFiles = fs
    .readdirSync(captionsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (verticalFiles.length === 0) {
    throw new Error("mergeWorker: nenhum vertical clip encontrado");
  }

  if (captionFiles.length === 0) {
    throw new Error("mergeWorker: nenhuma caption RAW encontrada");
  }

  console.log(
    `📦 Encontrados ${verticalFiles.length} clips e ${captionFiles.length} captions`
  );

  // ==============================
  // Mapeamento por índice
  // ==============================
  const mergedClips = [];

  for (const captionFile of captionFiles) {
    // Esperado: clip_1.json, clip_2.json, ...
    const match = captionFile.match(/clip_(\d+)\.json/);
    if (!match) continue;

    const clipIndex = Number(match[1]);

    const videoFile = `vertical_clip_${clipIndex}.mp4`;
    const videoPath = path.join(verticalDir, videoFile);

    if (!fs.existsSync(videoPath)) {
      console.warn(
        `⚠️ Clip ${clipIndex} ignorado (vídeo não encontrado)`
      );
      continue;
    }

    const captionsPath = path.join(captionsDir, captionFile);

    // Plano de merge (metadata)
    const plan = {
      jobId,
      clipIndex,
      videoPath,
      captionsPath,
      outputPath: path.resolve(
        "output",
        "final",
        jobId,
        `clip_${clipIndex}.mp4`
      ),
      createdAt: new Date().toISOString()
    };

    const planPath = path.join(
      mergeQueueDir,
      `clip_${clipIndex}.plan.json`
    );

    fs.writeFileSync(
      planPath,
      JSON.stringify(plan, null, 2),
      "utf-8"
    );

    mergedClips.push({
      clipIndex,
      videoPath,
      captionsPath,
      planPath,
      outputPath: plan.outputPath
    });
  }

  // ==============================
  // Validação final
  // ==============================
  if (mergedClips.length === 0) {
    throw new Error("mergeWorker: nenhum clip válido para merge");
  }

  console.log(
    `✅ Merge Worker preparou ${mergedClips.length} clips`
  );

  // ==============================
  // RETORNO OBRIGATÓRIO
  // ==============================
  return mergedClips;
}

module.exports = mergeWorker;
