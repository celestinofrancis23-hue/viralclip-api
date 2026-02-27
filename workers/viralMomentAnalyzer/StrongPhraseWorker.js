/**
 * StrongPhraseWorker
 * ------------------
 * Detecta inícios de clipes baseados em FRASES FORTES.
 * Multilíngue: EN / PT / ES / FR (extensível).
 *
 * Entrada: transcript[]
 * Saída: [{ start, reason, confidence, text }]
 */

const STRONG_PATTERNS = {
  // 🇺🇸 English
  en: [
    /\b(why|how|what if|did you know)\b/i,
    /\b(this is why|this is the reason|this is exactly)\b/i,
    /\b(most people think|but the truth is|however)\b/i,
    /\b(the biggest|the real|the main)\b/i
  ],

  // 🇧🇷 🇵🇹 Portuguese
  pt: [
    /\b(por que|como assim|você sabia)\b/i,
    /\b(a verdade é|isso é exatamente|é por isso que)\b/i,
    /\b(a maioria das pessoas pensa|mas a verdade é)\b/i,
    /\b(o maior|o verdadeiro|o principal)\b/i
  ],

  // 🇪🇸 Spanish
  es: [
    /\b(por qué|cómo es que|sabías que)\b/i,
    /\b(la verdad es|esto es exactamente|por eso)\b/i,
    /\b(la mayoría piensa|pero la verdad es)\b/i,
    /\b(el mayor|el verdadero|el principal)\b/i
  ],

  // 🇫🇷 French
  fr: [
    /\b(pourquoi|comment se fait-il|saviez-vous)\b/i,
    /\b(la vérité est|c’est exactement|c’est pour ça)\b/i,
    /\b(la plupart pensent|mais la vérité est)\b/i,
    /\b(le plus grand|le vrai|le principal)\b/i
  ]
};

/**
 * Normaliza texto
 */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();
}

/**
 * Detecta se a frase é forte em qualquer idioma suportado
 */
function isStrongPhrase(text) {
  const normalized = normalize(text);

  let matches = 0;

  for (const lang in STRONG_PATTERNS) {
    for (const pattern of STRONG_PATTERNS[lang]) {
      if (pattern.test(normalized)) {
        matches++;
      }
    }
  }

  return matches;
}

/**
 * Worker principal
 */
function StrongPhraseWorker(transcript = []) {
  if (!Array.isArray(transcript)) return [];

  const results = [];

  for (const segment of transcript) {
    if (!segment?.text || typeof segment.start !== 'number') continue;

    const score = isStrongPhrase(segment.text);

    if (score > 0) {
      results.push({
        start: segment.start,
        reason: 'strong_phrase',
        confidence: Math.min(1, score * 0.35),
        text: segment.text
      });
    }
  }

  return results;
}

module.exports = StrongPhraseWorker;
