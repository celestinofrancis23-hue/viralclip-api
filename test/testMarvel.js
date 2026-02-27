const path = require('path');
const marvelVerticalCrop = require('../vertical_crop/marvelVerticalCrop');

(async () => {
  try {
    console.log('🧪 Iniciando teste isolado da Marvel Vertical Crop...\n');

    const result = await marvelVerticalCrop({
      jobId: 'test-job-001',
      clipId: 'clip-test-001',
      inputVideoPath: path.resolve(
        'temp/913be80a-e885-4cc5-934f-8ce0bcfb8881/vertical_clips/clip_4.mp4'
      )
    });

    console.log('\n✅ RESULTADO DA MARVEL:\n');
    console.dir(result, { depth: null });

    console.log('\n🎯 Crop Decision:\n');
    console.table(result.cropDecision);

  } catch (err) {
    console.error('\n❌ ERRO NO TESTE:\n');
    console.error(err.message);
  }
})();
