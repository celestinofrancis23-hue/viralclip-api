// CaptionEngine/workers/normalizer.worker.js
// Filtra e alinha os segmentos do transcript para a janela de tempo do clipe
// Reajusta os timestamps para serem relativos ao início do clipe (t=0)

/**

- @param {object} params
- @param {object} params.clip       - { clipIndex, videoPath, startTime, endTime }
- @param {object} params.transcript - { segments: [{start, end, text}] }
- @returns {{ segments: NormalizedSegment[] }}
  */
  export async function NormalizerWorker({ clip, transcript }) {
  const { startTime, endTime } = clip;
  const clipDuration = endTime - startTime;

// 1. Filtra apenas os segmentos que estão dentro da janela do clipe
const raw = transcript.segments.filter((seg) => {
// Inclui segmento se há qualquer overlap com a janela do clipe
return seg.end > startTime && seg.start < endTime;
});

if (raw.length === 0) {
console.warn(`   ⚠️  NormalizerWorker: nenhum segmento encontrado para o clipe ${clip.clipIndex}`);
return { segments: [] };
}

// 2. Reajusta timestamps para serem relativos ao início do clipe (t=0)
const segments = raw.map((seg) => {
const relStart = Math.max(0, seg.start - startTime);
const relEnd   = Math.min(clipDuration, seg.end - startTime);

```
return {
  start: relStart,
  end:   relEnd,
  text:  cleanText(seg.text),
  words: tokenizeWords(seg.text, relStart, relEnd),
};
```

});

// 3. Remove segmentos que ficaram com duração inválida após o recorte
const valid = segments.filter((s) => s.end > s.start && s.text.length > 0);

// 4. Quebra segmentos muito longos (> 8 palavras) em linhas menores
const normalized = splitLongSegments(valid);

return { segments: normalized };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**

- Limpa o texto: remove ruídos do Whisper, normaliza espaços, pontuação
  */
  function cleanText(text) {
  return text
  .trim()
  .replace(/\s+/g, “ “)                    // múltiplos espaços → um
  .replace(/[^\w\sáàãâéêíóôõúüçÁÀÃÂÉÊÍÓÔÕÚÜÇ.,!?]/g, “”) // remove chars estranhos
  .replace(/\s([.,!?])/g, “$1”)            // remove espaço antes de pontuação
  .toUpperCase();                           // TikTok usa uppercase
  }

/**

- Tokeniza as palavras do segmento distribuindo timestamps uniformemente
- (Whisper basic não dá timestamps por palavra — distribuímos proporcionalmente)
  */
  function tokenizeWords(text, segStart, segEnd) {
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const duration = segEnd - segStart;
  const timePerWord = duration / words.length;

return words.map((word, i) => ({
word: word.replace(/[.,!?]$/, “”), // remove pontuação da palavra
start: segStart + i * timePerWord,
end:   segStart + (i + 1) * timePerWord,
punctuation: extractPunctuation(word),
}));
}

function extractPunctuation(word) {
const match = word.match(/([.,!?]+)$/);
return match ? match[1] : “”;
}

/**

- Quebra segmentos com mais de 8 palavras em múltiplas linhas
- mantendo os timestamps proporcionais
  */
  function splitLongSegments(segments, maxWords = 8) {
  const result = [];

for (const seg of segments) {
if (seg.words.length <= maxWords) {
result.push(seg);
continue;
}

```
// Divide em chunks de maxWords
for (let i = 0; i < seg.words.length; i += maxWords) {
  const chunk = seg.words.slice(i, i + maxWords);
  result.push({
    start: chunk[0].start,
    end:   chunk[chunk.length - 1].end,
    text:  chunk.map((w) => w.word + w.punctuation).join(" "),
    words: chunk,
  });
}
```

}

return result;
}
