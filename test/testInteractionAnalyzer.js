const InteractionAnalyzer = require(
  "../workers/viralMomentAnalyzer/InteractionAnalyzer"
);

(async () => {
  const mockInput = {
    mode: "Viral Moment",
    language: "fr",
    reasoningBlocks: [
      {
        blockId: 0,
        start: 0,
        end: 12,
        duration: 12,
        text: "Tu crois que j'ai fait ça pour rien ?",
        confidence: 1.0
      },
      {
        blockId: 1,
        start: 12,
        end: 25,
        duration: 13,
        text: "Je continue mon chemin sans regarder derrière.",
        confidence: 0.9
      }
    ]
  };

  const result = await InteractionAnalyzer(mockInput);

  console.log("✅ InteractionAnalyzer OUTPUT:");
  console.dir(result, { depth: null });
})();
