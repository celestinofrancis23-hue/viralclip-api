// analyzers/emotionalMomentAnalyzer.js

module.exports = async function emotionalMomentAnalyzer({ transcript }) {
  console.log("💙 [EmotionalMomentAnalyzer] Iniciando análise emocional...");

  if (!transcript?.segments || transcript.segments.length === 0) {
    throw new Error("Transcript inválido ou vazio");
  }

  const moments = [];

  for (const segment of transcript.segments) {
    const duration = segment.end - segment.start;
    const words = segment.text.split(" ").length;
    const wordsPerSecond = words / Math.max(duration, 1);

    let score = 0;
    const reasons = [];

    // 🔹 Segmento mais longo → storytelling
    if (duration >= 7) {
      score += 1;
      reasons.push("long_emotional_segment");
    }

    // 🔹 Ritmo mais lento → emoção / reflexão
    if (wordsPerSecond < 2.2) {
      score += 1;
      reasons.push("slow_speech");
    }

    // 🔹 Texto longo → explicação emocional
    if (segment.text.length > 140) {
      score += 1;
      reasons.push("deep_statement");
    }

    // 🔹 Pausas fortes (heurística simples)
    if (segment.text.includes("...")) {
      score += 1;
      reasons.push("emotional_pause");
    }

    // 🎯 Threshold emocional
    if (score >= 3) {
      moments.push({
        start: segment.start,
        end: segment.end,
        score,
        text: segment.text,
        reason: reasons
      });
    }
  }

  console.log(
    `💙 [EmotionalMomentAnalyzer] ${moments.length} momentos emocionais encontrados`
  );

  return {
    mode: "Emotional Moment",
    moments
  };
};
