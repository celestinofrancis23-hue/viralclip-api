/**
 * Caption Text Formatter
 *
 * - Recebe palavras do WordSplitter
 * - Converte para MAIÚSCULAS
 * - REMOVE TODA pontuação
 * - Mantém start/end intactos
 * - Garante formato seguro para CaptionTimelineBuilder
 */

module.exports = function captionTextFormatter(wordsRaw) {
  console.log('🔥 [CaptionTextFormatter] Iniciando');

  // =========================
  // Validação forte
  // =========================
  if (!Array.isArray(wordsRaw)) {
    console.error(
      '❌ [CaptionTextFormatter] wordsRaw NÃO é array:',
      typeof wordsRaw,
      wordsRaw
    );
    return [];
  }

  console.log(
    `✅ [CaptionTextFormatter] Palavras recebidas: ${wordsRaw.length}`
  );

  if (wordsRaw.length === 0) {
    console.warn('⚠️ [CaptionTextFormatter] Array vazio recebido');
    return [];
  }

  // Debug da primeira palavra RAW
  console.log(
    '🔎 [CaptionTextFormatter] Exemplo palavra RAW:',
    wordsRaw[0]
  );

  // =========================
  // Limpeza + formatação
  // =========================
  const formatted = wordsRaw
    .map((w, index) => {
      if (!w || typeof w.word !== 'string') {
        console.warn(
          `⚠️ [CaptionTextFormatter] Palavra inválida no índice ${index}:`,
          w
        );
        return null;
      }

      // 🔥 LIMPEZA TOTAL DE PONTUAÇÃO
      const cleanWord = w.word
        .toUpperCase()
        // remove tudo que NÃO for letra ou número
        .replace(/[^A-ZÀ-ÖØ-öø-ÿ0-9]/g, '')
        .trim();

      if (!cleanWord) return null;

      return {
        word: cleanWord,
        start: Number(w.start),
        end: Number(w.end),
      };
    })
    .filter(Boolean);

  console.log(
    `✅ [CaptionTextFormatter] Palavras formatadas: ${formatted.length}`
  );

  if (formatted.length > 0) {
    console.log(
      '🔎 [CaptionTextFormatter] Exemplo palavra FORMATADA:',
      formatted[0]
    );
  } else {
    console.warn(
      '⚠️ [CaptionTextFormatter] Todas as palavras foram filtradas'
    );
  }

  return formatted;
};
