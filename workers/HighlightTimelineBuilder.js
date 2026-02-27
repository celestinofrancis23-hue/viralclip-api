// workers/HighlightTimelineBuilder.js
// CommonJS

/**
 * HighlightTimelineBuilder
 *
 * Objetivo:
 * - Transformar um array de "words" em uma timeline de eventos para highlight por palavra
 * - Suportar formatos diferentes de word (antigo e novo)
 *
 * Formatos suportados:
 * 1) Novo (o que aparece no teu log):
 *    { text: "WOW.", start: 0, end: 0.92, index?, clipIndex?, relativeStart?, relativeEnd? }
 *
 * 2) Antigo:
 *    { word: "WOW.", start: 12.4, end: 12.62, index: 0, clipIndex: 0, relativeStart: 0, relativeEnd: 0.22 }
 *
 * Saída (event):
 *  { start, end, text, wordIndex, clipIndex }
 */

module.exports = function HighlightTimelineBuilder(payload = {}) {
  const { words, clipIndex, options = {} } = payload;

  if (!Array.isArray(words)) {
    throw new Error("[HighlightTimelineBuilder] words inválido (não é array)");
  }

  const { highlightMode = "word" } = options;

  console.log("[HighlightTimelineBuilder] INPUT");
  console.log("words count:", words.length);
  console.log("clipIndex:", clipIndex);
  console.log("mode:", highlightMode);
  console.log("sample word:", words[0]);

  // Normaliza um "word" independente do formato que veio
  function normalizeWord(w, i) {
    if (!w || typeof w !== "object") return null;

    // Texto pode vir como text ou word
    const text = typeof w.text === "string" ? w.text : (typeof w.word === "string" ? w.word : "");

    // index pode vir como index, wordIndex, ou fallback i
    const wordIndex =
      typeof w.index === "number"
        ? w.index
        : typeof w.wordIndex === "number"
        ? w.wordIndex
        : i;

    // clipIndex pode vir no próprio word, ou do payload
    const resolvedClipIndex =
      typeof w.clipIndex === "number"
        ? w.clipIndex
        : typeof clipIndex === "number"
        ? clipIndex
        : 0;

    // Timing: prioriza relativeStart/relativeEnd se existir, senão usa start/end
    // (No teu pipeline atual, start/end já está relativo ao clip — start: 0, end: 0.92)
    const start =
      typeof w.relativeStart === "number"
        ? w.relativeStart
        : typeof w.start === "number"
        ? w.start
        : null;

    const end =
      typeof w.relativeEnd === "number"
        ? w.relativeEnd
        : typeof w.end === "number"
        ? w.end
        : null;

    if (!text || typeof start !== "number" || typeof end !== "number") {
      return null;
    }

    // Proteções básicas
    const safeStart = Math.max(0, start);
    const safeEnd = Math.max(safeStart, end);

    return {
      text,
      start: safeStart,
      end: safeEnd,
      wordIndex,
      clipIndex: resolvedClipIndex,
    };
  }

  const normalizedWords = [];
  for (let i = 0; i < words.length; i++) {
    const nw = normalizeWord(words[i], i);
    if (nw) normalizedWords.push(nw);
  }

  // Se não sobrou nada, loga claramente pra debug
  if (normalizedWords.length === 0) {
    console.log("[HighlightTimelineBuilder] OUTPUT");
    console.log("events count: 0");
    console.log("sample event: null");
    return [];
  }

  // MODE: word (1 evento por palavra)
  if (highlightMode === "word") {
    const timeline = normalizedWords.map((w) => ({
      start: w.start,
      end: w.end,
      text: w.text,
      wordIndex: w.wordIndex,
      clipIndex: w.clipIndex,
    }));

    console.log("[HighlightTimelineBuilder] OUTPUT");
    console.log("events count:", timeline.length);
    console.log("sample event:", timeline[0]);

    return timeline;
  }

  // Se no futuro tiveres outros modos, por enquanto cai no padrão
  const fallbackTimeline = normalizedWords.map((w) => ({
    start: w.start,
    end: w.end,
    text: w.text,
    wordIndex: w.wordIndex,
    clipIndex: w.clipIndex,
  }));

  console.log("[HighlightTimelineBuilder] OUTPUT (fallback)");
  console.log("events count:", fallbackTimeline.length);
  console.log("sample event:", fallbackTimeline[0]);

  return fallbackTimeline;
};
