/**
 * momentAggregator/index.js
 *
 * Responsabilidade:
 * - Receber eventos do Audio Analyzer e Video Analyzer
 * - Unificar tudo em uma linha do tempo
 * - Pontuar momentos
 * - Selecionar momentos finais (core moments)
 *
 * Saída:
 * candidateMoments[] → pronto para Transcript Targeted
 */

const mergeEvents = require("./mergeEvents");
const scoreMoments = require("./scoreMoments");
const selectCoreMoments = require("./selectCoreMoments");

async function momentAggregator({
  audioEvents = [],
  videoEvents = [],
  videoDuration,
  options = {}
}) {
  console.log("🧠 [Aggregator] Iniciando agregação de momentos");

  if (!videoDuration || videoDuration <= 0) {
    throw new Error("[Aggregator] videoDuration inválido");
  }

  /**
   * 1️⃣ Merge de eventos (áudio + vídeo)
   */
  const mergedEvents = mergeEvents({
    audioEvents,
    videoEvents
  });

  console.log(
    `🔗 [Aggregator] Eventos combinados: ${mergedEvents.length}`
  );

  /**
   * 2️⃣ Score dos momentos
   */
  const scoredMoments = scoreMoments({
    events: mergedEvents,
    videoDuration,
    options: options.scoring || {}
  });

  console.log(
    `⭐ [Aggregator] Momentos pontuados: ${scoredMoments.length}`
  );

  /**
   * 3️⃣ Seleção dos core moments finais
   */
  const candidateMoments = selectCoreMoments({
    moments: scoredMoments,
    videoDuration,
    options: options.selection || {}
  });

  console.log(
    `🎯 [Aggregator] Momentos finais selecionados: ${candidateMoments.length}`
  );

  /**
   * 4️⃣ Saída padronizada
   */
  return {
    type: "candidate_moments",
    total: candidateMoments.length,
    moments: candidateMoments
  };
}

module.exports = momentAggregator;
