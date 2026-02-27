const path = require("path");

// Workers
const TranscriptPreprocessor = require(
  "../workers/ViralMomentAnalyzer/TranscriptPreprocessor"
);

const ReasoningFlowAnalyzer = require(
  "../workers/ViralMomentAnalyzer/ReasoningFlowAnalyzer"
);

(async () => {
  try {
    const projectRoot = path.resolve(__dirname, "..");

    // ===== 1. TRANSCRIPT PREPROCESSOR =====
    const transcriptResult = await TranscriptPreprocessor({
      transcriptPath: path.join(
        projectRoot,
        "temp/92146703-c5ae-4529-a18d-5e281b2f2995/audio.json"
      ),
      mode: "Viral Moment",
      clipLength: 30
    });

    console.log("\n✅ TranscriptPreprocessor OUTPUT:");
    console.log(`Segments: ${transcriptResult.segments.length}`);
    console.log(`Language: ${transcriptResult.metadata.language}`);
    console.log("-----------------------------------");

    // ===== 2. REASONING FLOW ANALYZER =====
    const reasoningResult = ReasoningFlowAnalyzer({
      segments: transcriptResult.segments
    });

    console.log("\n🧠 ReasoningFlowAnalyzer OUTPUT:");
    console.log(`Reasoning blocks: ${reasoningResult.metadata.totalBlocks}\n`);

    reasoningResult.reasoningBlocks.forEach((block, i) => {
      console.log(
        `[Block ${i}] ${block.start.toFixed(2)}s → ${block.end.toFixed(2)}s`
      );
      console.log(`Duration: ${block.duration.toFixed(2)}s`);
      console.log(`Segments: ${block.segmentIds.length}`);
      console.log(`Confidence: ${block.confidence.toFixed(2)}`);
      console.log(`Text: ${block.text.slice(0, 120)}...`);
      console.log("-----------------------------------");
    });

    console.log("\n✅ TESTE CONCLUÍDO COM SUCESSO\n");

  } catch (err) {
    console.error("❌ Erro no teste:", err.message);
  }
})();
