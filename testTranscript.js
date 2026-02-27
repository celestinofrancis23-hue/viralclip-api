const path = require("path");
const { generateTranscript } = require("./services/transcriptEngine");

(async () => {
  try {
    const videoPath = path.join(
      __dirname,
      "clips_vertical",
      "clip_001_9x16.mp4" // MUDA o nome se for diferente
    );

    console.log("🎬 Usando vídeo:", videoPath);

    const output = await generateTranscript(videoPath);
    console.log("✅ Transcript gerado em:", output);
  } catch (err) {
    console.error("❌ Erro:", err.message);
  }
})();
