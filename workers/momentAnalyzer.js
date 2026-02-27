const viralMomentAnalyzer = require("./viralMomentAnalyzer");
const emotionalMomentAnalyzer = require("./emotionalMomentAnalyzer");

module.exports = async function momentAnalyzer({
  transcript,
  mode
}) {
  // ===============================
  // 1. Validação básica
  // ===============================
  if (!transcript) {
    throw new Error("[MomentAnalyzer] Transcript não informado");
  }

  if (!mode) {
    throw new Error("[MomentAnalyzer] Mode não informado no Job Contract");
  }

  console.log("🧠 [MomentAnalyzer] Iniciando análise de momentos");
  console.log("🎛️  Mode:", mode);

  // ===============================
  // 2. Roteamento por mode
  // ===============================
  if (mode === "Viral Moment") {
    console.log("🔥 [MomentAnalyzer] Delegando para ViralMomentAnalyzer");
    return await viralMomentAnalyzer({ transcript });
  }

  if (mode === "Emotional Moment") {
    console.log("❤️ [MomentAnalyzer] Delegando para EmotionalMomentAnalyzer");
    return await emotionalMomentAnalyzer({ transcript });
  }

  // ===============================
  // 3. Mode inválido
  // ===============================
  throw new Error(
    `[MomentAnalyzer] Mode inválido recebido: ${mode}`
  );
};
