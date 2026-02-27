const buildAssSubtitle = require('./workers/buildAssSubtitle');

const captionLayouts = [
  {
    start: 0,
    end: 2,
    align: 'center',
    position: 'bottom',
    lines: [
      {
        yOffset: 0,
        words: [
          { text: 'HELLO', color: '#FFFFFF', fontSize: 52 },
          { text: 'WORLD', color: '#FFFFFF', fontSize: 52 }
        ]
      }
    ]
  }
];

const assPath = buildAssSubtitle({
  captionLayouts,
  outputDir: './temp',
  assFileName: 'test.ass'
});

console.log('ASS GERADO EM:', assPath);
