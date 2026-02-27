const TranscriptWindowResolver = require(
  "../workers/verticalCropEngine/resolvers/TranscriptWindowResolver"
);

const transcriptSegments = [
  { start: 95, end: 98, text: "Antes do clip" },
  { start: 102, end: 105, text: "Olá pessoal" },
  { start: 110, end: 115, text: "Bem-vindos" },
  { start: 145, end: 150, text: "Depois do clip" }
];

const result = TranscriptWindowResolver({
  transcriptSegments,
  clipStart: 100,
  clipEnd: 140
});

console.log(JSON.stringify(result, null, 2));
