// contracts/caption/RenderResult.contract.js

/**
 * RenderResult Contract
 * ---------------------
 * Resultado final da renderização de um clipe.
 * É a única fonte de verdade sobre sucesso ou falha do render.
 */

const RenderResultContract = {
  /**
   * Índice do clipe renderizado
   */
  clipIndex: "number",

  /**
   * Caminho absoluto do vídeo final renderizado
   */
  outputVideoPath: "string",

  /**
   * Caminho absoluto do arquivo ASS gerado
   * null caso não tenha sido gerado
   */
  assPath: "string | null",

  /**
   * Indica se o render foi concluído com sucesso
   */
  success: "boolean",

  /**
   * Mensagem de erro legível (se houver)
   */
  errorMessage: "string | null",

  /**
   * Tempo total de renderização em milissegundos
   */
  renderTimeMs: "number"
};

module.exports = RenderResultContract;
