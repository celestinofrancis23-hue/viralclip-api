const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

module.exports = function BurnInWorker({
  jobId,
  jobDir,
  clipIndex,
  videoPath,
  assContent,
  captionLayouts,
  options = {},
}) {
  console.log('[BurnInWorker] START');
  console.log('[BurnInWorker] clipIndex:', clipIndex);

  if (!jobDir) {
    throw new Error('[BurnInWorker] jobDir ausente');
  }

  if (!videoPath) {
    throw new Error('[BurnInWorker] videoPath ausente');
  }

  if (!assContent || typeof assContent !== 'string') {
    throw new Error('[BurnInWorker] assContent inválido');
  }

  // ===============================
  // GARANTE DIRETÓRIO
  // ===============================
  if (!fs.existsSync(jobDir)) {
    fs.mkdirSync(jobDir, { recursive: true });
  }

  // ===============================
  // PATHS
  // ===============================
  const assPath = path.join(jobDir, `clip_${clipIndex}.ass`);
  const outputVideoPath = path.join(jobDir, `clip_${clipIndex}_burned.mp4`);

  // ===============================
  // SALVA ASS
  // ===============================
  fs.writeFileSync(assPath, assContent, 'utf8');
  console.log('[BurnInWorker] ASS salvo:', assPath);

  // ===============================
  // FFMPEG BURN-IN
  // ===============================
  const cmd = `
ffmpeg -y \
  -i "${videoPath}" \
  -vf "ass=${assPath}" \
  -c:v libx264 \
  -pix_fmt yuv420p \
  -c:a copy \
  "${outputVideoPath}"
`.trim();

  console.log('[BurnInWorker] FFmpeg command:\n', cmd);

  execSync(cmd, { stdio: 'inherit' });

  console.log('[BurnInWorker] END');

  // ===============================
  // RETORNO PADRONIZADO
  // ===============================
  return {
    jobId,
    clipIndex,
    inputVideoPath: videoPath,
    assPath,
    outputVideoPath,
    status: 'burned',
  };
};
