const VideoAnalyzer = require("../workers/videoAnalyzer");

(async () => {
  try {
    console.log("🚀 Iniciando teste isolado do VideoAnalyzer...");

    const videoPath =
      "/Users/celestinofrancisco/Desktop/viralclip-api/temp/0ce8a7f3-fd1d-4d76-b3ae-cbbf1c9060c8/source.mp4";

    console.log("📂 Video path usado:", videoPath);

    const result = await VideoAnalyzer({
      videoPath,
      jobId: "video-test-001"
    });

    console.log("✅ Resultado final:");
    console.dir(result, { depth: null });

  } catch (err) {
    console.error("❌ Erro no teste do VideoAnalyzer:");
    console.error(err.message);
  }
})();
