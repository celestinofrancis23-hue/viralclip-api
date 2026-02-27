// contracts/caption/CaptionLayout.contract.js

/**
 * Caption Layout Contract
 * -----------------------
 * Bloco visual de legenda exibido em um intervalo de tempo.
 * Agrupa palavras e define estrutura visual (linhas / posição).
 */

const CaptionLayoutContract = {
  /**
   * Identificador único do layout dentro do clipe
   */
  layoutIndex: "number",

  /**
   * Referência ao clipe
   */
  clipIndex: "number",

  /**
   * Timestamp RELATIVO ao clipe (em segundos)
   */
  start: "number",
  end: "number",

  /**
   * Palavras que compõem este layout
   * (ordem temporal obrigatória)
   */
  words: [
    {
      index: "number",
      text: "string",
      start: "number",
      end: "number",
      relativeStart: "number",
      relativeEnd: "number",
      clipIndex: "number"
    }
  ],

  /**
   * Linhas visuais (cada linha é um array de word indices)
   * Ex:
   * [
   *   [0,1,2],
   *   [3,4]
   * ]
   */
  lines: [
    ["number"]
  ],

  /**
   * Configuração visual base (não é estilo final)
   */
  layout: {
    /**
     * Alinhamento horizontal
     */
    align: "center | left | right",

    /**
     * Posição vertical relativa (0 = topo, 1 = fundo)
     * Ex: 0.85 → próximo ao rodapé
     */
    verticalAnchor: "number",

    /**
     * Espaçamento entre linhas (em px ou unidade relativa)
     */
    lineSpacing: "number"
  }
};

module.exports = CaptionLayoutContract;
