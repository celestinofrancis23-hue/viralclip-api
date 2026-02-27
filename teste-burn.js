const path = require("path");
const { burnInASS } = require("./burnInASS");

(async () => {
  try {
    const base = "/Users/celestinofrancisco/Desktop/viralclip-api";

    const videoPath = path.join(
      base,
      "temp/62301ff8-7583-4809-989d-5a3798eb140d/vertical/vertical_1.mp4"
    );

    const assPath = path.join(base, "TESTE_FORCADO.ass");

    const outputPath = path.join(base, "TESTE_FINAL_OK.mp4");

    await burnInASS({
      videoPath,
      assPath,
      outputPath
    });

    console.log("✅ SUCESSO: legenda aplicada com áudio");
  } catch (err) {
    console.error("❌ ERRO:", err.message);
  }
})();
