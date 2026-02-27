// captions/generateCaptions.js
const path = require("path");
const fs = require('fs');
const { exec } = require('child_process');

/**
 * Gera legendas (SRT) a partir de um vídeo usando Whisper local
 * (pode ser trocado futuramente por OpenAI API)
 */
async function generateCaptions({
  inputPath,
  jobId,
  clipIndex,
  language = 'pt'
}) {
  // =========================
  // 1️⃣ Validações fortes
  // =========================
  if (!inputPath) {
    throw new Error(`Job inválido: inputPath ausente (clip ${clipIndex})`);
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo de vídeo não existe: ${inputPath}`);
  }

  if (!jobId) {
    throw new Error('Job inválido: jobId ausente');
  }

  // =========================
  // 2️⃣ Pastas de saída
  // =========================
  const outputDir = path.join(
    process.cwd(),
    'captions',
    jobId
  );

  fs.mkdirSync(outputDir, { recursive: true });

  const outputSrt = path.join(
    outputDir,
    path.basename(inputPath).replace('.mp4', '.srt')
  );

  console.log('📝 Gerando captions:');
  console.log('   📄 Vídeo:', inputPath);
  console.log('   🌍 Idioma:', language);
  console.log('   📁 Saída:', outputSrt);

  // =========================
  // 3️⃣ Comando Whisper
  // =========================
  const cmd = `
whisper "${inputPath}" \
  --language ${language} \
  --model small \
  --output_format srt \
  --output_dir "${outputDir}"
`;

  // =========================
  // 4️⃣ Execução
  // =========================
  await new Promise((resolve, reject) => {
    exec(cmd, (error) => {
      if (error) {
        console.error('❌ Erro ao gerar captions:', error);
        return reject(error);
      }

      if (!fs.existsSync(outputSrt)) {
        return reject(new Error('Caption não foi gerada'));
      }

      resolve();
    });
  });

  console.log('✅ Caption gerada com sucesso:', outputSrt);

  // =========================
  // 5️⃣ Retorno padrão (SaaS-ready)
  // =========================
  return {
    clipIndex,
    language,
    srtPath: outputSrt
  };
}

module.exports = generateCaptions;
