/**
 * Viral Moment Analyzer
 * ---------------------
 * Orquestra todos os workers de análise de momentos virais
 * e retorna clips prontos para corte.
 */

const StrongPhraseWorker = require("./StrongPhraseWorker");
const NaturalStartWorker = require("./NaturalStartWorker");
const DebateWorker = require("./DebateWorker");
const ActionEnergyWorker = require("./ActionEnergyWorker");

const StartRankerDynamicSpacing = require("./StartRankerDynamicSpacing");
const EndBoundaryWorker = require("./EndBoundaryWorker");

/**
 * @param {Object} params
 * @param {Array} params.transcriptSegments - Array de segments do Whisper
 * @param {number} params.clipLengthSeconds
 * @param {number} params.clipCount
 */
module.exports = async function ViralMomentAnalyzer({
  transcriptSegments,
  clipLengthSeconds,
  clipCount,
}) {
  // ==============================
  // ✅ Validações básicas
  // ==============================
  if (!Array.isArray(transcriptSegments)) {
    throw new Error(
      "[ViralMomentAnalyzer] transcriptSegments must be an array"
    );
  }

  if (!clipLengthSeconds || !clipCount) {
    throw new Error(
      "[ViralMomentAnalyzer] clipLengthSeconds e clipCount são obrigatórios"
    );
  }

  console.log(
    `🧠 ViralMomentAnalyzer iniciado (${transcriptSegments.length} segments)`
  );

  // ==============================
  // 🔍 Workers de DETECÇÃO (START)
  // ==============================
  const strongPhraseResults = StrongPhraseWorker(
    transcriptSegments,
    clipLengthSeconds
  );

  const naturalStartResults = NaturalStartWorker(
    transcriptSegments,
    clipLengthSeconds
  );

  const debateResults = DebateWorker(transcriptSegments);

  const actionEnergyResults = ActionEnergyWorker(transcriptSegments);

  console.log("📊 Detecção concluída:", {
    strongPhrase: strongPhraseResults.length,
    naturalStart: naturalStartResults.length,
    debate: debateResults.length,
    actionEnergy: actionEnergyResults.length,
  });

// ==============================
// 🧮 Ranker + Dynamic Spacing (CORRETO)
// ==============================

const bufferSeconds = 10; // igual ao teste

const candidatesByType = {
  strong_phrase: strongPhraseResults,
  natural_start: naturalStartResults,
  debate: debateResults,
  action_energy: actionEnergyResults,
};

const rankerResult = StartRankerDynamicSpacing({
  candidatesByType,
  clipCount,
  clipLengthSeconds,
  bufferSeconds,
});

// 🔒 Garantia de array
const rankedStarts = Array.isArray(rankerResult?.selected)
  ? rankerResult.selected
  : [];

console.log("🏁 Starts rankeados:", rankedStarts.length);

  // ==============================
  // ⛔ Definição de END boundaries
  // ==============================
// ✅ DEFINIÇÃO DE END BOUNDARIES (CORRETO)
const finalClips = EndBoundaryWorker({
  rankedClips: rankedStarts,
  transcriptSegments,
  lookbackSeconds: 10,
});

  console.log(
    `🔥 Viral clips finalizados: ${finalClips.length}`
  );

  return finalClips;
};
