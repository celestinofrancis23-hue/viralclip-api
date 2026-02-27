// clipPipelineMerge.js
const path = require('path');

/**
 * Clip Pipeline Merge
 *
 * Responsabilidade:
 * - Receber os clips já cortados
 * - Criar um contrato claro para o Vertical Crop Worker
 * - NÃO processa vídeo
 */
function clipPipelineMerge(cutClips, jobId, jobDir) {
  if (!Array.isArray(cutClips)) {
    throw new Error('clipPipelineMerge: cutClips deve ser um array');
  }

  const outputDir = path.join(jobDir, 'vertical_cropped');

  return cutClips.map((clipPath, index) => {
    if (typeof clipPath !== 'string') {
      throw new Error(`clipPipelineMerge: clipPath inválido no índice ${index}`);
    }

    const baseName = path.basename(clipPath, '.mp4');

    return {
      id: index + 1,

      // INPUT REAL PARA O WORKER
      inputVideoPath: clipPath,

      // ONDE O WORKER VAI SALVAR
      outputDir,

      // PATH FINAL ESPERADO
      outputVideoPath: path.join(
        outputDir,
        `${baseName}_vertical.mp4`
      )
    };
  });
}

module.exports = clipPipelineMerge;

