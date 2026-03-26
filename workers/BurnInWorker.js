const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

module.exports = function BurnInWorker({
  jobId,
  jobDir,
  clipIndex,
  videoPath,
  assContent,
}) {
  return new Promise((resolve, reject) => {
    try {
      console.log('🔥 [BurnInWorker] START');
      console.log('🎬 clipIndex:', clipIndex);

      if (!jobDir) throw new Error('jobDir ausente');
      if (!videoPath || !fs.existsSync(videoPath))
        throw new Error('videoPath inválido');
      if (!assContent || typeof assContent !== 'string')
        throw new Error('assContent inválido');

      // ===============================
      // DIR
      // ===============================
      fs.mkdirSync(jobDir, { recursive: true });

      const assPath = path.join(jobDir, `clip_${clipIndex}.ass`);
      const outputVideoPath = path.join(
        jobDir,
        `clip_${clipIndex}_burned.mp4`
      );

      // ===============================
      // SALVAR ASS
      // ===============================
      fs.writeFileSync(assPath, assContent, 'utf8');
      console.log('💾 ASS salvo:', assPath);

      // ===============================
      // ESCAPE PATH (CRÍTICO)
      // ===============================
      const safeAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');

      // ===============================
      // FFMPEG ARGS (OTIMIZADO)
      // ===============================
      const args = [
        '-y',
        '-i', videoPath,

        '-vf', `ass=${safeAssPath}`,

        '-map', '0:v:0',
        '-c:v', 'libx264',

        // 🔥 CONTROLE DE PERFORMANCE
        '-preset', 'ultrafast',
        '-crf', '28',
        '-threads', '1',

        '-pix_fmt', 'yuv420p',

        '-map', '0:a?',
        '-c:a', 'aac',
        '-b:a', '96k',

        '-movflags', '+faststart',

        outputVideoPath,
      ];

      console.log('🎬 FFmpeg args:\n', args.join(' '));

      // ===============================
      // SPAWN (PROFISSIONAL)
      // ===============================
      const ffmpeg = spawn('ffmpeg', args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      ffmpeg.stderr.on('data', (data) => {
        const msg = data.toString();
        console.log('⚠️ FFmpeg:', msg);
      });

      ffmpeg.on('error', (err) => {
        return reject(new Error('Erro ao iniciar FFmpeg: ' + err.message));
      });

      ffmpeg.on('close', (code, signal) => {
        console.log('🧪 FFmpeg terminou:', { code, signal });

        if (code !== 0) {
          return reject(
            new Error(`FFmpeg falhou (code=${code}, signal=${signal})`)
          );
        }

        // ===============================
        // VALIDA OUTPUT
        // ===============================
        if (!fs.existsSync(outputVideoPath)) {
          return reject(new Error('Arquivo final não foi gerado'));
        }

        const stats = fs.statSync(outputVideoPath);

        if (stats.size < 50_000) {
          return reject(new Error('Arquivo final inválido ou muito pequeno'));
        }

        console.log('✅ Burn-in concluído:', outputVideoPath);

        resolve({
          jobId,
          clipIndex,
          inputVideoPath: videoPath,
          assPath,
          outputVideoPath,
          status: 'burned',
        });
      });

    } catch (err) {
      reject(err);
    }
  });
};
