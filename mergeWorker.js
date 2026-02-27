const fs = require("fs");
const path = require("path");

/**
 * Merge Worker (PREPARADOR)
 * - trabalha por job
 * - NÃO usa FFmpeg
 * - NÃO edita vídeo
 * - cria planos de merge por clip
 */
async function mergeWorker({ jobId }) {
  if (!jobId) {
    throw new Error("mergeWorker: jobId ausente");
  }

  console.log("🧩 Merge Worker iniciado:", jobId);

  // paths base
  const verticalDir = path.resolve("vertical_clips", jobId);
  const captionsDir = path.resolve("captions", "raw", jobId);
  const mergeDir = path.resolve("merge", "queue", jobId);

  // validações básicas
  if (!fs.existsSync(verticalDir)) {
    throw new Error(`mergeWorker: pasta vertical_clips não encontrada (${verticalDir})`);
  }

  if (!fs.existsSync(captionsDir)) {
    throw new Error(`mergeWorker: pasta captions RAW não encontrada (${captionsDir})`);
  }

  fs.mkdirSync(mergeDir, { recursive: true });

  console.log("📁 Diretórios OK");
  console.log("➡️ vertical:", verticalDir);
  console.log("➡️ captions:", captionsDir);
  console.log("➡️ merge:", mergeDir);

  // próximos passos virão aqui
  console.log("⏭️ Próximo passo: mapear clips");

  return {
    jobId,
    status: "initialized"
  };
}

module.exports = mergeWorker;
