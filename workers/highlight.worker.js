// CaptionEngine/workers/highlight.worker.js
// Detecta palavras fortes usando heurística inteligente
// Sem custo de API — baseado em semântica, fonética e contexto de pregação

/**

- @param {object} params
- @param {object} params.clip
- @param {Array}  params.segments - segmentos normalizados
- @returns {{ segments: HighlightedSegment[] }}
  */
  export async function HighlightWorker({ clip, segments }) {
  if (!segments.length) return { segments: [] };

const highlighted = segments.map((seg) => ({
…seg,
words: seg.words.map((w) => ({
…w,
score:       scoreWord(w.word, seg.words),
isHighlight: false, // será definido abaixo
})),
}));

// Define highlight baseado no score + contexto do segmento
for (const seg of highlighted) {
const scores = seg.words.map((w) => w.score);
const maxScore = Math.max(…scores);
const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

```
// Threshold dinâmico: palavra precisa ser notavelmente acima da média
const threshold = Math.max(avgScore * 1.4, 3);

seg.words = seg.words.map((w) => ({
  ...w,
  isHighlight: w.score >= threshold || w.score === maxScore && maxScore >= 4,
}));
```

}

return { segments: highlighted };
}

// ─── Sistema de Score ─────────────────────────────────────────────────────────
// Score vai de 0 a 10. Palavras acima do threshold dinâmico são destacadas.

function scoreWord(word, allWords) {
const w = word.toUpperCase().replace(/[^A-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ]/g, “”);
let score = 0;

// ── 1. Léxico de alto impacto ──────────────────────────────────────────────
score += LEXICON_SCORE[w] || 0;

// ── 2. Características fonéticas (palavras que “soam forte”) ──────────────
if (w.length >= 7) score += 1;                      // palavras longas têm mais peso
if (/[!]/.test(word)) score += 2;                   // pontuação de impacto
if (/^[A-ZÁÀÃÂÉÊÍÓÔÕÚÜÇ]{5,}$/.test(w)) score += 1; // all-caps originalmente

// ── 3. Padrões semânticos ──────────────────────────────────────────────────
if (isVerboDeAcao(w)) score += 2;
if (isSubstantivoEspiritual(w)) score += 3;
if (isAdjetivoIntensificador(w)) score += 2;
if (isNegacaoEnfatica(w)) score += 2;
if (isNumeralOuQuantidade(w)) score += 1;

// ── 4. Contexto posicional no segmento ────────────────────────────────────
const pos = allWords.findIndex((aw) => aw.word === word);
const total = allWords.length;
if (pos === total - 1) score += 1;   // última palavra tem mais peso (conclusão)
if (pos === 0) score += 0.5;         // primeira também (abertura)

// ── 5. Repetição (palavra repetida = ênfase intencional) ──────────────────
const occurrences = allWords.filter((aw) => aw.word === word).length;
if (occurrences > 1) score += 1.5;

return Math.min(score, 10); // cap em 10
}

// ─── Classificadores ─────────────────────────────────────────────────────────

function isVerboDeAcao(w) {
const verbos = new Set([
“CRER”, “ACREDITAR”, “CONFIAR”, “ORAR”, “CLAMAR”, “GRITAR”, “LOUVAR”,
“ADORAR”, “PROCLAMAR”, “DECLARAR”, “ROMPER”, “QUEBRAR”, “LIBERTAR”,
“CURAR”, “SALVAR”, “TRANSFORMAR”, “UNGIR”, “CONSAGRAR”, “REVELAR”,
“MANIFESTAR”, “TOCAR”, “MOVER”, “AGIR”, “RESPONDER”, “VENCER”,
“SUPERAR”, “CONQUISTAR”, “ENTREGAR”, “RENDER”, “PROSTRAR”,
]);
return verbos.has(w);
}

function isSubstantivoEspiritual(w) {
const substantivos = new Set([
“DEUS”, “JESUS”, “CRISTO”, “ESPÍRITO”, “SANTO”, “PAI”, “SENHOR”,
“FÉ”, “GRAÇA”, “AMOR”, “PODER”, “GLÓRIA”, “PRESENÇA”, “UNÇÃO”,
“AVIVAMENTO”, “MILAGRE”, “CURA”, “SALVAÇÃO”, “LIBERTAÇÃO”, “VITÓRIA”,
“PROPÓSITO”, “DESTINO”, “CHAMADO”, “MISSÃO”, “REINO”, “CÉU”,
“PALAVRA”, “BÍBLIA”, “ORAÇÃO”, “JEJUM”, “AVIVAMENTO”, “FOGO”,
“SANGUE”, “CRUZ”, “RESSURREIÇÃO”, “ETERNIDADE”, “ALMA”, “ESPÍRITO”,
“PROFECIA”, “VISÃO”, “SONHO”, “PROMESSA”, “PACTO”, “ALIANÇA”,
]);
return substantivos.has(w);
}

function isAdjetivoIntensificador(w) {
const adjetivos = new Set([
“IMPOSSÍVEL”, “INCRÍVEL”, “PODEROSO”, “GLORIOSO”, “ETERNO”, “DIVINO”,
“SOBRENATURAL”, “MILAGROSO”, “ABSURDO”, “TREMENDO”, “EXTRAORDINÁRIO”,
“INCOMPREENSÍVEL”, “INDESCRITÍVEL”, “IMENSO”, “INFINITO”, “PERFEITO”,
“REAL”, “VERDADEIRO”, “FIEL”, “JUSTO”, “SANTO”, “PURO”, “LIVRE”,
“COMPLETO”, “PLENO”, “TOTAL”, “RADICAL”, “ABSOLUTO”,
]);
return adjetivos.has(w);
}

function isNegacaoEnfatica(w) {
// Negações em pregação têm muito peso (“NÃO vou desistir”, “NUNCA mais”)
return [“NÃO”, “NUNCA”, “JAMAIS”, “NADA”, “NINGUÉM”, “NEM”].includes(w);
}

function isNumeralOuQuantidade(w) {
return /^\d+$/.test(w) || [“MIL”, “MILHÃO”, “MILHÕES”, “TODO”, “TODOS”, “TUDO”].includes(w);
}

// ─── Léxico de score direto ───────────────────────────────────────────────────
// Palavras com score fixo alto por serem universalmente impactantes em pregações

const LEXICON_SCORE = {
// Nomes sagrados — sempre máximo
“DEUS”: 8, “JESUS”: 8, “CRISTO”: 7, “ESPÍRITO”: 7,

// Palavras de clímax espiritual
“MILAGRE”: 7, “CURA”: 7, “LIBERTAÇÃO”: 7, “SALVAÇÃO”: 7, “AVIVAMENTO”: 7,
“FOGO”: 6, “GLÓRIA”: 6, “UNÇÃO”: 6, “PODER”: 6, “PRESENÇA”: 6,

// Verbos de alta intensidade
“VENCER”: 6, “LIBERTAR”: 6, “TRANSFORMAR”: 6, “RESSUSCITAR”: 7,

// Palavras de urgência emocional
“HOJE”: 5, “AGORA”: 5, “NUNCA”: 5, “SEMPRE”: 4, “TUDO”: 4,
“IMPOSSÍVEL”: 6, “POSSÍVEL”: 4,

// Interjeições de pregação
“AMÉM”: 5, “ALELUIA”: 6, “GLÓRIA”: 6,
};
