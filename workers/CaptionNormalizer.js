/**
 * CaptionNormalizer
 *
 * Responsabilidade:
 * - Receber transcript bruto (Whisper)
 * - Garantir um formato ÚNICO e previsível
 * - NÃO segmenta
 * - NÃO estiliza
 *
 * OUTPUT (contrato obrigatório):
 * [
 *   {
 *     start: Number,
 *     end: Number,
 *     text: String
 *   }
 * ]
 */

function CaptionNormalizer({ transcriptSegments }) {
  console.log("🟡 [CaptionNormalizer] Iniciando...");
  
  if (!Array.isArray(transcriptSegments)) {
    throw new Error("[CaptionNormalizer] transcriptSegments inválido (não é array)");
  }

  const normalized = [];

  for (let i = 0; i < transcriptSegments.length; i++) {
    const seg = transcriptSegments[i];

    if (!seg) continue;

    // Casos possíveis vindos do Whisper
    const start = Number(seg.start);
    const end = Number(seg.end);

    let text = "";

    // Caso 1: Whisper padrão (seg.text)
    if (typeof seg.text === "string") {
      text = seg.text;
    }

    // Caso 2: Whisper com words[]
    else if (Array.isArray(seg.words)) {
      text = seg.words.map(w => w.word || "").join(" ");
    }

    // Segurança
    if (!text || !text.trim()) continue;
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    if (end <= start) continue;

    normalized.push({
      start,
      end,
      text: text.trim()
    });
  }

  console.log(`🟢 [CaptionNormalizer] Retornando ${normalized.length} captions normalizadas`);

  // LOG DE AMOSTRA (importantíssimo para debug)
  if (normalized.length > 0) {
    console.log("🧪 [CaptionNormalizer] Sample:", normalized[0]);
  }

  return normalized;
}

module.exports = CaptionNormalizer;
