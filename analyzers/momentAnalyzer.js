const viralMomentAnalyzer = require("./viralMomentAnalyzer");
const emotionalMomentAnalyzer = require("./emotionalMomentAnalyzer");

module.exports = async function momentAnalyzer({ transcript, job, jobDir }) {
  const mode = job.settings?.mode;

  console.log("🧠 [MomentAnalyzer] Mode:", mode);

if (!transcript || !Array.isArray(transcript.segments)) {
  throw new Error("Transcript inválido antes do MomentAnalyzer");
}

  if (mode === "Viral Moment") {
    return viralMomentAnalyzer({ transcript, job, jobDir });
  }

  if (mode === "Emotional Moment") {
    return emotionalMomentAnalyzer({ transcript, job, jobDir });
  }

  throw new Error(`Modo inválido: ${mode}`);
};

