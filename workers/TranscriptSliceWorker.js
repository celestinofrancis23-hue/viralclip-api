// services/captionEngine/index.js

// workers/TranscriptSliceWorker.js

/**
 * TranscriptSliceWorker
 *
 * Responsabilidade única:
 * Receber um transcript completo (tempo absoluto)
 * e devolver apenas os segmentos que pertencem ao clip,
 * com tempo RELATIVO ao início do clip.
 */

module.exports = function TranscriptSliceWorker({
  transcriptSegments,
  startTime,
  endTime,
}) {
  // ==============================
  // LOG DE ENTRADA
  // ==============================
  console.log('\n🟦 [TranscriptSliceWorker] INPUT');
  console.log('startTime:', startTime);
  console.log('endTime:', endTime);
  console.log('segments count:', Array.isArray(transcriptSegments) ? transcriptSegments.length : 'INVALID');
  console.log('sample segment:', transcriptSegments?.[0]);

  // ==============================
  // VALIDAÇÕES
  // ==============================
  if (!Array.isArray(transcriptSegments)) {
    throw new Error('[TranscriptSliceWorker] transcriptSegments deve ser um array');
  }

  if (typeof startTime !== 'number' || typeof endTime !== 'number') {
    throw new Error('[TranscriptSliceWorker] startTime/endTime inválidos');
  }

  if (endTime <= startTime) {
    throw new Error('[TranscriptSliceWorker] endTime deve ser maior que startTime');
  }

  // ==============================
  // SLICE + NORMALIZAÇÃO
  // ==============================
  const sliced = transcriptSegments
    .filter(s => s.end > startTime && s.start < endTime)
    .map(s => ({
      start: Math.max(0, s.start - startTime),
      end: Math.min(endTime - startTime, s.end - startTime),
      text: s.text,
    }));

  // ==============================
  // LOG DE SAÍDA
  // ==============================
  console.log('🟩 [TranscriptSliceWorker] OUTPUT');
  console.log('sliced count:', sliced.length);
  console.log('sample sliced:', sliced[0]);
  console.log('────────────────────────────────');

  return sliced;
};

