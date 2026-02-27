const path = require('path');

const marvelVerticalCrop = require('../vertical_crop/marvelVerticalCrop');
const applyVerticalCrop = require('../vertical_crop/applyVerticalCrop');

(async () => {
  try {
    console.log('🧪 Iniciando teste isolado ApplyVerticalCrop...\n');

    const jobId = '913be80a-e885-4cc5-934f-8ce0bcfb8881';
    const clipId = 'clip-test-001';

    const inputVideoPath = path.resolve(
      '/Users/celestinofrancisco/Desktop/viralclip-api/temp/dbb5cdcc-05e9-4bf7-a241-90a775d45bb5/vertical_clips/clip_2.mp4'
    );

const fs = require('fs');

console.log('📁 inputVideoPath:', inputVideoPath);
console.log('📁 Existe?', fs.existsSync(inputVideoPath));

    const outputVideoPath = path.resolve(
      'temp/test/output_vertical_test.mp4'
    );

    // ===============================
    // 1️⃣ MARVEL DECIDE O CROP
    // ===============================

const marvelResult = await marvelVerticalCrop({
  jobId,
  clipId,
  inputVideoPath
});

const cropDecision = marvelResult.cropDecision;
    console.log('🧠 Crop Decision (Marvel):');
    console.table(cropDecision);

    // ===============================
    // 2️⃣ APPLY VERTICAL CROP
    // ===============================
    const result = await applyVerticalCrop({
      jobId,
      clipId,
      inputVideoPath,
      outputVideoPath,
      cropDecision
    });

    console.log('\n✅ RESULTADO FINAL:');
    console.dir(result, { depth: null });

  } catch (err) {
    console.error('\n❌ ERRO NO TESTE ISOLADO:\n');
    console.error(err.message);
  }
})();
