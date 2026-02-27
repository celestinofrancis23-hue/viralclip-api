// contracts/caption/CaptionPayload.contract.js

/**
 * CaptionPayload Contract
 * -----------------------
 * Payload único de entrada da CaptionEngine.
 * Nenhum worker deve receber dados fora deste contrato.
 */

const CaptionPayloadContract = {
  /**
   * Identificador único do job
   * Ex: UUID, hash, timestamp
   */
  jobId: "string",

  /**
   * Diretório base do job (onde tudo será salvo)
   */
  jobDir: "string",

  /**
   * Transcript completo do vídeo
   */
  transcript: {
    language: "string",
    segments: "array" // validado via Transcript.contract
  },

  /**
   * Lista de clips a serem processados
   */
  clips: "array" // array de Clip.contract
};

module.exports = CaptionPayloadContract;
