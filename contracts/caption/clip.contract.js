// contracts/caption/Clip.contract.js

/**
 * Clip Contract
 * -------------
 * Representa um recorte lógico de um vídeo.
 * Não conhece transcript, palavras ou layout.
 */

const ClipContract = {
  /**
   * Identificador único do clip dentro do job
   * Ex: 0, 1, 2...
   */
  clipIndex: "number",

  /**
   * Caminho absoluto do vídeo de origem
   */
  videoPath: "string",

  /**
   * Tempo inicial do clip (em segundos)
   */
  startTime: "number",

  /**
   * Tempo final do clip (em segundos)
   */
  endTime: "number"
};

module.exports = ClipContract;
