/**
 * NarrativeBoundaryFixer
 * --------------------------------------------------
 * Responsabilidade:
 * - Receber blocos reativos (ReactionSignalAnalyzer)
 * - Normalizar tempos
 * - Garantir coerência narrativa
 * - Preparar blocos finais para corte de vídeo
 *
 * CONTRATO:
 * Input:
 * {
 *   reactiveBlocks: Array<{
 *     start: number,
 *     end: number,
 *     reaction?: {
 *       hasReaction: boolean,
 *       type: string | null,
 *       intensity: number
 *     }
 *   }>,
 *   language: string,
 *   clipLength: number
 * }
 *
 * Output:
 * {
 *   narrativeBlocks: Array<{
 *     start: number,
 *     end: number,
 *     duration: number,
 *     narrativeScore: number,
 *     reaction?: object
 *   }>
 * }
 */

module.exports = function NarrativeBoundaryFixer({
  reactiveBlocks,
  language,
  clipLength
}) {
  // ==============================
  // VALIDATION
  // ==============================
  if (!Array.isArray(reactiveBlocks)) {
    throw new Error(
      "[NarrativeBoundaryFixer] reactiveBlocks inválido (não é array)"
    );
  }

  if (typeof clipLength !== "number" || clipLength <= 0) {
    throw new Error(
      "[NarrativeBoundaryFixer] clipLength inválido"
    );
  }

  // ==============================
  // NORMALIZAÇÃO DEFENSIVA
  // ==============================
const safeBlocks = reactiveBlocks
  .filter(block => {
    return (
      typeof block.start === "number" &&
      typeof block.end === "number" &&
      block.start >= 0 &&
      block.end > block.start
    );
  })
  .sort((a, b) => a.start - b.start);

  if (safeBlocks.length === 0) {
    throw new Error(
      "[NarrativeBoundaryFixer] nenhum bloco narrativo válido após normalização"
    );
  }

  // ==============================
  // CONSTRUÇÃO NARRATIVA
  // ==============================
  const narrativeBlocks = safeBlocks.map((block, index) => {
    const duration = block.end - block.start;

    // Score narrativo simples (pode evoluir depois)
    let narrativeScore = 0.5;

    if (block.reaction?.hasReaction) {
      narrativeScore += block.reaction.intensity || 0;
    }

    narrativeScore = Math.min(1, narrativeScore);

    return {
      start: Number(block.start.toFixed(2)),
      end: Number(block.end.toFixed(2)),
      duration: Number(duration.toFixed(2)),
      narrativeScore,
      reaction: block.reaction || null,
      language
    };
  });

  // ==============================
  // OUTPUT FINAL
  // ==============================
  return {
    narrativeBlocks
  };
};
