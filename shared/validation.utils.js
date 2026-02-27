/**
 * Validation Utils
 * Funções únicas de validação de contratos
 */

function validateTranscriptSegments(segments) {
  if (!Array.isArray(segments)) {
    throw new Error('[Validation] transcriptSegments deve ser array');
  }

  segments.forEach((seg, i) => {
    if (typeof seg.start !== 'number') {
      throw new Error(`[Validation] segment[${i}].start inválido`);
    }
    if (typeof seg.end !== 'number') {
      throw new Error(`[Validation] segment[${i}].end inválido`);
    }
    if (typeof seg.text !== 'string') {
      throw new Error(`[Validation] segment[${i}].text inválido`);
    }
  });
}

function validateWords(words) {
  if (!Array.isArray(words)) {
    throw new Error('[Validation] words deve ser array');
  }

  words.forEach((word, i) => {
    if (typeof word.word !== 'string') {
      throw new Error(`[Validation] word[${i}].word inválido`);
    }
    if (typeof word.start !== 'number') {
      throw new Error(`[Validation] word[${i}].start inválido`);
    }
    if (typeof word.end !== 'number') {
      throw new Error(`[Validation] word[${i}].end inválido`);
    }
    if (typeof word.clipIndex !== 'number') {
      throw new Error(`[Validation] word[${i}].clipIndex inválido`);
    }
  });
}

module.exports = {
  validateTranscriptSegments,
  validateWords,
};
