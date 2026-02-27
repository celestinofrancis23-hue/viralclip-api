const path = require("path");

const VerticalCropEngine = require(
  "../workers/verticalCropEngine"
);

(async () => {
  try {
    console.log("🧪 Teste Vertical Crop Engine iniciado");

    const inputClipPath = path.join(
      __dirname,
      "../temp/aa747b37-b048-42d3-96c6-be887fb49fec/clips/clip_12.mp4"
    );

    const outputClipPath = path.join(
      __dirname,
      "../outputs/test-vertical.mp4"
    );

    const transcriptSegments = [
      {
        start: 0,
        end: 4,
        text: "Hello everyone, welcome to this video"
      },
      {
        start: 4,
        end: 9,
        text: "Today we are talking about something important"
      }
    ];

    const result = await VerticalCropEngine({
      clipPath: inputClipPath,
      outputPath: outputClipPath,
      transcriptSegments
    });

    console.log("✅ Teste concluído com sucesso");
    console.log("📤 Vídeo gerado:", result.outputVideoPath);
  } catch (err) {
    console.error("❌ Erro no teste:", err);
  }
})();
