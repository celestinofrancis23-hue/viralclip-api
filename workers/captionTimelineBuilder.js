/**
 * Caption Timeline Builder
 * ------------------------
 * Constrói legendas visuais a partir de palavras temporizadas
 */

module.exports = function captionTimelineBuilder({ words }) {
  if (!Array.isArray(words) || words.length === 0) {
    throw new Error('[CaptionTimelineBuilder] words inválido ou vazio');
  }

  const MAX_WORDS_PER_LINE = 3; // 🔥 estilo Reels/TikTok
  const timeline = [];

  let buffer = [];
  let lineStart = null;

  for (const w of words) {
    if (!w || !w.word || w.start == null || w.end == null) {
      continue; // ignora lixo silenciosamente
    }

    if (buffer.length === 0) {
      lineStart = w.start;
    }

    buffer.push(w.word);

    // cria linha quando bate limite
    if (buffer.length >= MAX_WORDS_PER_LINE) {
      timeline.push({
        start: lineStart,
        end: w.end,
        text: buffer.join(' ')
      });

      buffer = [];
      lineStart = null;
    }
  }

  // flush final
  if (buffer.length > 0) {
    const lastWord = words[words.length - 1];

    timeline.push({
      start: lineStart,
      end: lastWord.end,
      text: buffer.join(' ')
    });
  }

  if (timeline.length === 0) {
    throw new Error('[CaptionTimelineBuilder] timeline vazia após processamento');
  }

  console.log(
    `🧩 [CaptionTimelineBuilder] ${timeline.length} captions criadas`
  );

  return timeline;
};
