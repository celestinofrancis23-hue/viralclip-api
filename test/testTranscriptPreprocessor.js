const path = require("path");
const TranscriptPreprocessor = require(
  "../workers/viralMomentAnalyzer/TranscriptPreprocessor"
);
const projectRoot = path.resolve(__dirname, "..");
(async () => {
  try {
const result = await TranscriptPreprocessor({
  transcriptPath: path.join(
    projectRoot,
    "temp/92146703-c5ae-4529-a18d-5e281b2f2995/audio.json"
  ),
  mode: "Viral Moment",
  clipLength: 30
});
    console.log("✅ TranscriptPreprocessor OUTPUT:");
    console.dir(result, { depth: null });

  } catch (err) {
    console.error("❌ Erro no teste:", err.message);
  }
})();
