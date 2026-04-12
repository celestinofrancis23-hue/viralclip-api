// CaptionEngine/workers/style.worker.js
// Aplica estilo visual TikTok a cada palavra
// Palavras normais: branco | Palavras fortes: amarelo + maior + shake

/**

- @param {object} params
- @param {Array}  params.segments - segmentos com highlight marcado
- @returns {{ segments: StyledSegment[] }}
  */
  export async function StyleWorker({ segments }) {
  const styled = segments.map((seg) => ({
  …seg,
  words: seg.words.map((w) => ({
  …w,
  style: buildWordStyle(w),
  })),
  }));

return { segments: styled };
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

/**

- Retorna o objeto de estilo para uma palavra
- Esses valores são usados pelo AssWorker para gerar o .ASS
  */
  function buildWordStyle(word) {
  if (word.isHighlight) {
  return highlightStyle(word.score);
  }
  return normalStyle();
  }

function normalStyle() {
return {
fontName:    “Montserrat”,
fontSize:    72,
bold:        true,
italic:      false,
primaryColor: “&H00FFFFFF”,   // branco
outlineColor: “&H00000000”,   // preto
shadowColor:  “&H80000000”,   // sombra semi-transparente
outline:     3,
shadow:      2,
animation:   null,
scaleX:      100,
scaleY:      100,
};
}

function highlightStyle(score) {
// Score 4-5 → amarelo | 6-7 → laranja | 8-10 → vermelho vibrante
const color = scoreToColor(score);
const fontSize = scoreFontSize(score);
const animation = scoreAnimation(score);

return {
fontName:    “Montserrat”,
fontSize,
bold:        true,
italic:      false,
primaryColor: color,
outlineColor: “&H00000000”,
shadowColor:  “&H80000000”,
outline:     4,
shadow:      3,
animation,
scaleX:      100,
scaleY:      100,
};
}

// ─── Mapeamentos de score → propriedades visuais ──────────────────────────────

function scoreToColor(score) {
if (score >= 8) return “&H0000FFFF”; // ciano brilhante (máximo impacto)
if (score >= 6) return “&H0000AAFF”; // laranja vibrante
if (score >= 4) return “&H0000FFFF”; // amarelo clássico TikTok
return “&H00FFFFFF”;                 // branco (fallback)
}

// Nota: cores ASS são em BGR (Blue Green Red), não RGB:
// Amarelo TikTok = &H0000FFFF  (B=00, G=FF, R=FF → amarelo)
// Laranja        = &H000099FF  (B=00, G=99, R=FF → laranja)
// Ciano/Azul     = &H00FFFF00  (B=FF, G=FF, R=00 → ciano)

function scoreFontSize(score) {
if (score >= 8) return 96;   // enorme
if (score >= 6) return 84;   // grande
if (score >= 4) return 78;   // médio-grande
return 72;                    // padrão
}

function scoreAnimation(score) {
// Animações ASS: aplicadas via \t() tags no evento
if (score >= 8) {
return {
type: “shake_scale”,   // escala + tremor
scaleFrom: 90,
scaleTo:   115,
durationMs: 120,
};
}
if (score >= 6) {
return {
type: “scale_pop”,     // pop suave
scaleFrom: 95,
scaleTo:   108,
durationMs: 100,
};
}
if (score >= 4) {
return {
type: “fade_in”,       // aparece com fade
durationMs: 80,
};
}
return null;
}

// ─── Constantes exportadas (usadas pelo AssWorker) ────────────────────────────

export const CAPTION_POSITION = {
// Posição vertical da legenda no vídeo (para formato 9:16)
// 0 = topo, 100 = base — legenda fica a 75% da altura (padrão TikTok)
verticalPercent: 75,
alignment: 2,  // ASS alignment: 2 = centro-baixo
marginV: 80,   // margem vertical em pixels
};

export const FONTS = {
primary: “Montserrat”,
fallback: “Arial”,
};
