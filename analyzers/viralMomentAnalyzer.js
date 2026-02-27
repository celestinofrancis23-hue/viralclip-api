// analyzers/viralMomentAnalyzer.js

module.exports = async function viralMomentAnalyzer({ transcript }) {
  console.log("🔥 [ViralMomentAnalyzer] Iniciando análise viral...");

  if (!transcript) {
    throw new Error("Transcript não recebido");
  }

  let segments = [];

  // ✅ Caso padrão: Whisper com segments
  if (Array.isArray(transcript.segments) && transcript.segments.length > 0) {
    segments = transcript.segments;
  }

  // ⚠️ Fallback: só texto (gera segmento único)
  if (segments.length === 0 && transcript.text) {
    console.warn("⚠️ [ViralMomentAnalyzer] Nenhum segment encontrado, usando fallback de texto único");

    segments = [
      {
        start: 0,
        end: 60,
        text: transcript.text
      }
    ];
  }

  if (segments.length === 0) {
    throw new Error("Transcript inválido: nenhum texto analisável");
  }

  const candidates = [];

  for (const segment of segments) {
    if (!segment.text) continue;

    const duration = (segment.end ?? 0) - (segment.start ?? 0);
    const wordCount = segment.text.split(/\s+/).length;

    let score = 0;
    const reasons = [];

    // 🎯 Segmento mais longo (história)
    if (duration >= 6) {
      score += 1;
      reasons.push("long_segment");
    }

    // 🗣️ Densidade de fala
    if (wordCount >= 20) {
      score += 1;
      reasons.push("high_word_density");
    }

    // ❓ Hook (pergunta)
    if (segment.text.includes("?")) {
      score += 1;
      reasons.push("question_hook");
    }

const narrativeHooks = [
  // Português
  "então",
  "depois disso",
  "a verdade é",
  "nesse caso",
  "em seguida",

  // Inglês
  "then",
  "after that",
  "the truth is",
  "what happened",
  "in this case",

  // Espanhol
  "entonces",
  "después de eso",
  "la verdad es",
  "en este caso",

  // Francês
  "alors",
  "après ça",
  "la vérité est"
];

console.log(
  "[Segment]",
  segment.start.toFixed(1),
  "→",
  segment.end.toFixed(1),
  "| score:",
  score,
  "| reasons:",
  reasons
);


if (narrativeHooks.some(h =>
  segment.text.toLowerCase().includes(h)
)) {
  score += 1;
  reasons.push("narrative_hook");
}

    // 💥 Declaração forte
    if (segment.text.length >= 120) {
      score += 1;
      reasons.push("strong_statement");
    }

    // ✅ Threshold
    if (score >= 1) {
      candidates.push({
        start: segment.start,
        end: segment.end,
        score,
        text: segment.text,
        reasons
      });
    }
  }

  console.log(
    `🔥 [ViralMomentAnalyzer] ${candidates.length} momentos virais encontrados`
  );

  return {
    mode: "Viral Moment",
    moments: candidates
  };
};
