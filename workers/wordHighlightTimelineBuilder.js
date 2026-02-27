/**
 * Word Highlight Timeline Builder
 *
 * Objetivo:
 * - Criar uma timeline baseada em PALAVRA
 * - Cada palavra vira um evento
 * - Palavra ativa fica VERDE
 * - As outras ficam BRANCAS
 * - Sincronização segue exatamente o tempo da fala
 *
 * Entrada:
 * [
 *   { word: "WHY", start: 12.43, end: 12.60 },
 *   { word: "DONT", start: 12.65, end: 12.88 }
 * ]
 *
 * Saída:
 * [
 *   {
 *     start: 12.43,
 *     end: 12.60,
 *     activeWordIndex: 0,
 *     words: [...]
 *   }
 * ]
 */

module.exports = function wordHighlightTimelineBuilder(words, options = {}) {
  console.log("🟢 [WordHighlightBuilder] Iniciando");

  if (!Array.isArray(words) || words.length === 0) {
    console.error("❌ [WordHighlightBuilder] Words inválidas ou vazias");
    return [];
  }

  const {
    highlightColor = "#00FF6A", // verde neon
    baseColor = "#FFFFFF",     // branco
    scaleActive = 1.18,        // palavra ativa maior
    scaleInactive = 1.0
  } = options;

  const timeline = [];

  for (let i = 0; i < words.length; i++) {
    const activeWord = words[i];

    const frameWords = words.map((w, index) => ({
      text: w.word,
      color: index === i ? highlightColor : baseColor,
      scale: index === i ? scaleActive : scaleInactive
    }));

    timeline.push({
      start: Number(activeWord.start.toFixed(3)),
      end: Number(activeWord.end.toFixed(3)),
      activeWordIndex: i,
      words: frameWords
    });
  }

  console.log(
    `✅ [WordHighlightBuilder] Frames criados: ${timeline.length}`
  );

  console.log(
    "🔍 [WordHighlightBuilder] Exemplo frame:",
    timeline[0]
  );

  return timeline;
};
