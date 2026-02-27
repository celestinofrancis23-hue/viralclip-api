const path = require("path");
const AudioAnalyzer = require("../workers/audioAnalyzer");

async function runTest() {
  try {
    const audioPath = path.resolve(
      __dirname,
      "/Users/celestinofrancisco/Desktop/viralclip-api/temp/0ce8a7f3-fd1d-4d76-b3ae-cbbf1c9060c8/audio.wav"
    );

    console.log("🔍 Iniciando teste do AudioAnalyzer...");

    const result = await AudioAnalyzer({
      audioPath,
      jobId: "audio-test-001",
      options: {
        frameSize: 1024,
        energyThreshold: 1.6
      }
    });

    console.log("✅ Resultado final:");
    console.dir(result, { depth: null });

  } catch (err) {
    console.error("❌ Erro no teste:", err);
  }
}

runTest();
