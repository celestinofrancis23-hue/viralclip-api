const generateSRT = require('./services/generateSRT');

generateSRT({
  segments: [
    { start: 0.0, end: 2.5, text: 'Olá mundo' },
    { start: 2.5, end: 5.0, text: 'Isto é um teste' }
  ],
  outputPath: './test.srt'
});

console.log('SRT gerado com sucesso');

