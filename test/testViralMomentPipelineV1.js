/**
 * testViralMomentPipelineV1.js
 * ----------------------------
 * Pipeline de TESTE — Viral Moment Analyzer
 * Usa transcript REAL a partir de um caminho no disco
 */

const fs = require("fs");
const path = require("path");

const StrongPhraseWorker = require(
  "../workers/ViralMomentAnalyzer/StrongPhraseWorker"
);

// ============================================
// CONFIGURAÇÃO — CAMINHO DO TRANSCRIPT
// ============================================

const projectRoot = path.resolve(__dirname, "..");

// 👉 ESTE É O CAMINHO QUE VOCÊ MOSTROU NO PRINT
const transcriptPath = path.join(
  projectRoot,
  "temp/4ea4eeeb-673d-45eb-bac8-1875686fe90b/audio.json"
);

// ============================================
// LOAD TRANSCRIPT FROM DISK
// ============================================

function loadTranscriptFromDisk(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[TestPipeline] Transcript não encontrado: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error("[TestPipeline] Transcript JSON inválido");
  }

  // Aceita dois formatos comuns
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed.segments)) {
    return parsed.segments;
  }

  throw new Error(
    "[TestPipeline] Transcript não contém array nem em root nem em .segments"
  );
}

// ============================================
// TEST PIPELINE
// ============================================

(function runTestPipeline() {
  console.log("\n=====================================");
  console.log("🚀 TESTE OFICIAL — STRONG PHRASE WORKER");
  console.log("=====================================\n");

  // 1️⃣ Load transcript
  const transcriptSegments = loadTranscriptFromDisk(transcriptPath);

  console.log(`📄 Transcript carregado`);
  console.log(`Segmentos encontrados: ${transcriptSegments.length}\n`);

  // 2️⃣ Run StrongPhraseWorker
  const strongPhraseResults = StrongPhraseWorker(transcriptSegments);

  console.log(`🔥 Frases fortes detectadas: ${strongPhraseResults.length}\n`);

  strongPhraseResults.forEach((item, index) => {
    console.log(`🟡 ${index + 1}`);
    console.log(`Start: ${item.start}s`);
    console.log(`Confidence: ${item.confidence}`);
    console.log(`Text: "${item.text}"`);
    console.log("----------------------------------");
  });

const NaturalStartWorker = require(
  "../workers/ViralMomentAnalyzer/NaturalStartWorker"
);

console.log("\n🟢 TESTE — NATURAL START WORKER\n");

const naturalStartResults = NaturalStartWorker(transcriptSegments);

console.log(`Inícios naturais detectados: ${naturalStartResults.length}\n`);

naturalStartResults.forEach((item, index) => {
  console.log(`🟢 ${index + 1}`);
  console.log(`Start: ${item.start}s`);
  console.log(`Text: "${item.text}"`);
  console.log("----------------------------------");
});

const DebateWorker = require(
  "../workers/ViralMomentAnalyzer/DebateWorker"
);

console.log("\n🟣 TESTE — DEBATE WORKER\n");

const debateResults = DebateWorker(transcriptSegments);

console.log(`Interações detectadas: ${debateResults.length}\n`);

debateResults.forEach((item, index) => {
  console.log(`🟣 ${index + 1}`);
  console.log(`Start: ${item.start}s`);
  console.log(`Confidence: ${item.confidence}`);
  console.log(`Reasons: ${item.meta.reasons.join(", ")}`);
  console.log(`Text: "${item.text}"`);
  console.log("----------------------------------");
});

const ActionEnergyWorker = require(
  "../workers/ViralMomentAnalyzer/ActionEnergyWorker"
);

console.log("\n🔵 TESTE — ACTION ENERGY WORKER\n");

const actionEnergyResults = ActionEnergyWorker(transcriptSegments);

console.log(`Momentos de ação/energia detectados: ${actionEnergyResults.length}\n`);

actionEnergyResults.forEach((item, index) => {
  console.log(`🔵 ${index + 1}`);
  console.log(`Start: ${item.start}s`);
  console.log(`Confidence: ${item.confidence}`);
  console.log(`Reasons: ${item.meta.reasons.join(", ")}`);
  console.log(`Text: "${item.text}"`);
  console.log("----------------------------------");
});

// ============================================
// START RANKER + DYNAMIC SPACING (NOVO)
// ============================================

const StartRankerDynamicSpacing = require(
  "../workers/ViralMomentAnalyzer/StartRankerDynamicSpacing"
);

console.log("\n🎯 TESTE — START RANKER + DYNAMIC SPACING (NOVO)\n");

// ✅ Configs do teste (você pode mudar depois)
const clipCount = 30;
const clipLengthSeconds = 30;
const bufferSeconds = 10;

// ✅ Monta candidatesByType (os workers já devem estar rodados acima)
const candidatesByType = {
  strong_phrase: strongPhraseResults,
  natural_start: naturalStartResults,
  debate_interaction: debateResults,
  action_energy: actionEnergyResults,
};

// ✅ Chama o ranker novo (ele agora gera endCandidate e startText)
const rankerResult = StartRankerDynamicSpacing({
  candidatesByType,
  clipCount,
  clipLengthSeconds,
  bufferSeconds,
});

// ✅ Resumo
console.log("Resumo do Ranker:");
console.log(`Clipes pedidos: ${rankerResult.requestedClipCount}`);
console.log(`Clipes selecionados: ${rankerResult.selectedCount}\n`);

// ✅ Lista (agora com startText e endCandidate)
rankerResult.selected.forEach((item, index) => {
  console.log(`🎯 ${index + 1}`);
  console.log(`Start: ${item.start}s`);
  console.log(`EndCandidate: ${item.endCandidate}s`);
  console.log(`Reason: ${item.reason}`);
  console.log(`Priority: ${item.priority}`);
  console.log(`Confidence: ${item.confidence}`);
  console.log(`StartText: "${item.startText}"`);
  console.log("----------------------------------");
});

const EndBoundaryWorker = require(
  "../workers/ViralMomentAnalyzer/EndBoundaryWorker"
);

const finalClips = EndBoundaryWorker({
  rankedClips: rankerResult.selected,
  transcriptSegments,
  lookbackSeconds: 10,
});

finalClips.forEach((clip, i) => {
  console.log(`🎬 ${i + 1}`);
  console.log(`Start: ${clip.start}s`);
  console.log(`End: ${clip.end}s`);
  console.log(`StartText: "${clip.startText}"`);
  console.log(`EndText: "${clip.endText}"`);
  console.log("----------------------------------");
});

console.log("\n✅ Teste finalizado\n");

  console.log("\n✅ Teste finalizado\n");
})();
