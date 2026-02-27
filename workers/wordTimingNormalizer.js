/**
 * Word Timing Normalizer
 * Ajusta start/end das palavras para seguir a fala real
 */

module.exports = function wordTimingNormalizer(words, options = {}) {
  console.log("🧠 [WordTimingNormalizer] Iniciando");

console.log("🔥🔥🔥 NOVO WORD TIMING NORMALIZER CARREGADO 🔥🔥🔥");

  if (!Array.isArray(words)) {
    console.error("❌ [WordTimingNormalizer] Entrada inválida (não é array)");
    return [];
  }

  if (words.length === 0) {
    console.warn("⚠️ [WordTimingNormalizer] Array vazio recebido");
    return [];
  }

  const {
    minWordDuration = 0.12,
    maxWordDuration = 1.2,
    pauseThreshold = 0.25,
    smoothing = 0.04,
  } = options;

  const normalized = [];

  for (let i = 0; i < words.length; i++) {
    const current = words[i];
    const prev = words[i - 1];
    const next = words[i + 1];

    if (
      typeof current.start !== "number" ||
      typeof current.end !== "number"
    ) {
      console.warn(
        `⚠️ [WordTimingNormalizer] Palavra inválida ignorada no índice ${i}`,
        current
      );
      continue;
    }

    // 🔥 Corrige texto (aceita word OU text)
    const safeText =
      typeof current.text === "string"
        ? current.text
        : typeof current.word === "string"
        ? current.word
        : null;

    if (!safeText) {
      console.warn(
        `⚠️ [WordTimingNormalizer] Palavra sem texto no índice ${i}`,
        current
      );
      continue;
    }

    let start = current.start;
    let end = current.end;

    // 1️⃣ Ajuste baseado na palavra anterior
    if (prev) {
      const gapFromPrev = start - prev.end;

      if (gapFromPrev <= pauseThreshold) {
        start = Math.max(prev.end + smoothing, start - smoothing);
      }
    }

    // 2️⃣ Ajuste baseado na próxima palavra
    if (next) {
      const gapToNext = next.start - end;

      if (gapToNext <= pauseThreshold) {
        end = Math.min(next.start - smoothing, end + smoothing);
      }
    }

    // 3️⃣ Garantir duração mínima
    if (end - start < minWordDuration) {
      end = start + minWordDuration;
    }

    // 4️⃣ Limitar duração máxima
    if (end - start > maxWordDuration) {
      end = start + maxWordDuration;
    }

    normalized.push({
      text: safeText, // 🔥 GARANTIDO
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
    });
  }

  console.log(
    `✅ [WordTimingNormalizer] Palavras normalizadas: ${normalized.length}`
  );

  if (normalized[0]) {
    console.log(
      "🔎 Exemplo palavra normalizada:",
      normalized[0]
    );
  }

  return normalized;
};
