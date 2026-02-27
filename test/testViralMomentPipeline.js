/**
 * VIRAL MOMENT PIPELINE — TESTE OFICIAL (v1.0)
 * -------------------------------------------------
 * Pipeline:
 * 1. TranscriptPreprocessor
 * 2. ReasoningFlowAnalyzer
 * 3. Adapter (Reasoning → Interaction)
 * 4. InteractionAnalyzer
 * 5. ReactionSignalAnalyzer
 *
 * Regra:
 * - Nenhum worker depende de dados implícitos
 * - clipLength é contrato global
 */

const path = require("path");

// ======================================
// WORKERS
// ======================================
const TranscriptPreprocessor = require(
  "../workers/ViralMomentAnalyzer/TranscriptPreprocessor"
);

const ReasoningFlowAnalyzer = require(
  "../workers/ViralMomentAnalyzer/ReasoningFlowAnalyzer"
);

const InteractionAnalyzer = require(
  "../workers/ViralMomentAnalyzer/InteractionAnalyzer"
);

const ReactionSignalAnalyzer = require(
  "../workers/ViralMomentAnalyzer/ReactionSignalAnalyzer"
);

const NarrativeBoundaryFixer = require(
  "../workers/ViralMomentAnalyzer/NarrativeBoundaryFixer"
);

const ViralMomentScorer = require(
  "../workers/ViralMomentAnalyzer/ViralMomentScorer"
);

const CandidateRanker = require(
  "../workers/ViralMomentAnalyzer/CandidateRanker"
); 

const ClipAssembler = require('../workers/ViralMomentAnalyzer/ClipAssembler');

const FinalClipSelector = require(
  '../workers/ViralMomentAnalyzer/FinalClipSelector'
);

const ClipExportBuilder = require(
  "../workers/ViralMomentAnalyzer/ClipExportBuilder"
);

const FINAL_CLIP_COUNT = 10;
const CLIP_LENGTH_SECONDS = 30;
const clipCount = 10; // teste controlado 
// ======================================
// ADAPTER
// ======================================
const reasoningToInteractionAdapter = require(
  "../workers/ViralMomentAnalyzer/adapters/reasoningToInteraction.adapter"
);

// ======================================
// TEST RUNNER
// ======================================
(async () => {
  try {
    const projectRoot = path.resolve(__dirname, "..");

    console.log("\n===============================");
    console.log("🧪 TESTE OFICIAL — VIRAL MOMENT");
    console.log("===============================\n");

    // =================================================
    // 1️⃣ TRANSCRIPT PREPROCESSOR
    // =================================================
    const transcriptResult = await TranscriptPreprocessor({
      transcriptPath: path.join(
        projectRoot,
        "temp/cbfd179f-51b1-4115-9104-ad9c13d6b54d/audio.json"
      ),
      mode: "Viral Moment",
      clipLength: 30
    });

    if (!Array.isArray(transcriptResult.segments)) {
      throw new Error("[Pipeline] TranscriptPreprocessor retornou segments inválido");
    }

    const clipLength =
      transcriptResult.metadata?.clipLength ?? 30;

    console.log("✅ TranscriptPreprocessor OK");
    console.log(`Segments: ${transcriptResult.segments.length}`);
    console.log(`Language: ${transcriptResult.metadata.language}`);
    console.log(`Clip length: ${clipLength}s`);
    console.log("--------------------------------\n");

    // =================================================
    // 2️⃣ REASONING FLOW ANALYZER
    // =================================================
    const reasoningResult = ReasoningFlowAnalyzer({
      segments: transcriptResult.segments
    });

    if (!Array.isArray(reasoningResult.reasoningBlocks)) {
      throw new Error("[Pipeline] ReasoningFlowAnalyzer retornou reasoningBlocks inválido");
    }

    console.log("🧠 ReasoningFlowAnalyzer OK");
    console.log(`Reasoning blocks: ${reasoningResult.reasoningBlocks.length}`);

    reasoningResult.reasoningBlocks.forEach((block, i) => {
      console.log(
        `[Block ${i}] ${block.start.toFixed(2)}s → ${block.end.toFixed(2)}s | conf ${block.confidence.toFixed(2)}`
      );
    });

    console.log("--------------------------------\n");

    // =================================================
    // 3️⃣ ADAPTER (CONTRATO GLOBAL)
    // =================================================
    const adaptedBlocks = reasoningToInteractionAdapter({
      reasoningBlocks: reasoningResult.reasoningBlocks,
      clipLength
    });

    if (!Array.isArray(adaptedBlocks)) {
      throw new Error("[Pipeline] Adapter retornou blocos inválidos");
    }

    console.log("🔁 Adapter OK");
    console.log(`Adapted blocks: ${adaptedBlocks.length}`);
    console.log("--------------------------------\n");

    // =================================================
    // 4️⃣ INTERACTION ANALYZER
    // =================================================
    const interactionResult = InteractionAnalyzer({
      blocks: adaptedBlocks
    });

    if (!Array.isArray(interactionResult.enrichedBlocks)) {
      throw new Error("[Pipeline] InteractionAnalyzer retornou enrichedBlocks inválido");
    }

    console.log("💬 InteractionAnalyzer OK");
    console.log(`Enriched blocks: ${interactionResult.enrichedBlocks.length}`);

    interactionResult.enrichedBlocks.forEach((block, i) => {
      console.log(
        `[Block ${i}] interaction=${block.interaction.hasInteraction} | intensity=${block.interaction.intensity}`
      );
    });

    console.log("--------------------------------\n");

    // =================================================
    // 5️⃣ REACTION SIGNAL ANALYZER
    // =================================================
    const reactionResult = ReactionSignalAnalyzer({
      enrichedBlocks: interactionResult.enrichedBlocks,
      language: transcriptResult.metadata.language,
      clipLength
    });

    if (!Array.isArray(reactionResult.reactiveBlocks)) {
      throw new Error("[Pipeline] ReactionSignalAnalyzer retornou reactiveBlocks inválido");
    }

    console.log("⚡ ReactionSignalAnalyzer OK");
    console.log(`Reactive blocks: ${reactionResult.reactiveBlocks.length}`);

    reactionResult.reactiveBlocks.forEach((block, i) => {
      console.log(
        `[Block ${i}] reaction=${block.reaction.hasReaction} | type=${block.reaction.type} | intensity=${block.reaction.intensity}`
      );
    });

// =================================================
// 6️⃣ NARRATIVE BOUNDARY FIXER
// =================================================
const narrativeResult = NarrativeBoundaryFixer({
  reactiveBlocks: reactionResult.reactiveBlocks,
  clipLength
});

if (!Array.isArray(narrativeResult.narrativeBlocks)) {
  throw new Error("[Pipeline] NarrativeBoundaryFixer retornou narrativeBlocks inválido");
}

console.log("📐 NarrativeBoundaryFixer OK");
console.log(`Narrative blocks: ${narrativeResult.narrativeBlocks.length}`);

narrativeResult.narrativeBlocks.forEach((block, i) => {
  console.log(
    `[Block ${i}] ${block.start.toFixed(2)}s → ${block.end.toFixed(2)}s | score=${block.score}`
  );
});

// =================================================
// 7️⃣ VIRAL MOMENT SCORER
// =================================================
const scoreResult = ViralMomentScorer({
  narrativeBlocks: narrativeResult.narrativeBlocks,
  clipLength
});

if (!Array.isArray(scoreResult.scoredBlocks)) {
  throw new Error("[Pipeline] ViralMomentScorer retornou scoredBlocks inválido");
}

console.log("🏆 ViralMomentScorer OK");
console.log(`Scored blocks: ${scoreResult.scoredBlocks.length}`);

scoreResult.scoredBlocks.forEach((block, i) => {
  console.log(
    `[Block ${i}] ${block.start.toFixed(2)}s → ${block.end.toFixed(2)}s | score=${block.score}`
  );
});

// =================================================
// 8️⃣ CANDIDATE RANKER (SEM CLIP COUNT)
// =================================================
const candidateResult = CandidateRanker({
  scoredBlocks: scoreResult.scoredBlocks,
  minScore: 90,        // score mínimo aceitável
  minGapSeconds: 10    // distância mínima entre seeds
});

if (!Array.isArray(candidateResult.candidateSeeds)) {
  throw new Error("[Pipeline] CandidateRanker retornou candidateSeeds inválido");
}

console.log("🏁 CandidateRanker OK");
console.log(`Candidate seeds: ${candidateResult.candidateSeeds.length}`);

candidateResult.candidateSeeds.forEach((seed, i) => {
  console.log(
    `[Seed ${i}] start=${seed.seedStart.toFixed(2)}s | score=${seed.score} | reason=${seed.reason}`
  );
});

// 9️⃣ CLIP ASSEMBLER

const assemblerResult = ClipAssembler({
  candidateSeeds: candidateResult.candidateSeeds,
  clipLength: CLIP_LENGTH_SECONDS
});

if (!Array.isArray(assemblerResult.clips)) {
  throw new Error('[Pipeline] ClipAssembler retornou clips inválidos');
}

console.log('🎬 ClipAssembler OK');
console.log(`Final clips: ${assemblerResult.clips.length}`);

assemblerResult.clips.forEach((clip, i) => {
  console.log(
    `[Clip ${i}] ${clip.start.toFixed(2)}s → ${clip.end.toFixed(2)}s | duration=${clip.duration}s | score=${clip.score}`
  );
});

// 10️⃣ FINAL CLIP SELECTOR
const finalResult = FinalClipSelector({
  clips: assemblerResult.clips,
  clipCount: FINAL_CLIP_COUNT,
  minGapSeconds: 10
});

if (!Array.isArray(finalResult.finalClips)) {
  throw new Error('[Pipeline] FinalClipSelector retornou finalClips inválido');
}

console.log('🎯 FinalClipSelector OK');
console.log(`Final clips selected: ${finalResult.finalClips.length}`);

finalResult.finalClips.forEach((clip, i) => {
  console.log(
    `[FinalClip ${i}] ${clip.start.toFixed(2)}s → ${clip.end.toFixed(2)}s | duration=${clip.duration}s | score=${clip.score}`
  );
});

// 11️⃣ CLIP EXPORT BUILDER
const exportResult = ClipExportBuilder({
  finalClips: finalClipResult.finalClips,
  videoSource: "input.mp4", // ou path real
  jobId: "test_job_001"
});

console.log("📦 ClipExportBuilder OK");
console.log(`Export clips: ${exportResult.clips.length}`);

exportResult.clips.forEach((clip) => {
  console.log(
    `[ExportClip ${clip.index}] ${clip.start}s → ${clip.end}s | file=${clip.outputFile}`
  );
  console.log(`FFmpeg: ${clip.ffmpegCommand}`);
});

console.log("--------------------------------\n");

    console.log("\n✅ PIPELINE VIRAL MOMENT EXECUTADA COM SUCESSO\n");

  } catch (err) {
    console.error("\n❌ ERRO NO TESTE DA PIPELINE");
    console.error(err.message);
    console.error(err.stack);
  }
})();

