const captionEngine = require("./engines/captionEngine");

const words = [
  { word: "Olá", start: 0.2, end: 0.4 },
  { word: "mundo", start: 0.5, end: 0.9 },
  { word: "isso", start: 1.2, end: 1.4 },
  { word: "é", start: 1.5, end: 1.6 },
  { word: "teste", start: 1.7, end: 2.0 },
];

const result = captionEngine({
  transcriptWords: words,
  windowStart: 0.4,
  windowEnd: 1.6,
});

console.log(result);

