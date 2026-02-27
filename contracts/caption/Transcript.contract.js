// contracts/caption/Transcript.contract.js

/**
 * Transcript Contract
 * -------------------
 * Representa o texto falado bruto, com timestamps contínuos.
 * Fonte única da verdade para qualquer processamento posterior.
 */

const TranscriptContract = {
  /**
   * Idioma do áudio
   * Ex: "en", "pt", "pt-BR"
   */
  language: "string",

  /**
   * Lista de segmentos falados
   */
  segments: [
    {
      /**
       * Tempo inicial (em segundos)
       */
      start: "number",

      /**
       * Tempo final (em segundos)
       */
      end: "number",

      /**
       * Texto bruto falado (sem formatação)
       */
      text: "string"
    }
  ]
};

module.exports = TranscriptContract;
