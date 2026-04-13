async function NormalizerWorker({ clip, transcript }) {
  const { startTime, endTime } = clip;
  const clipDuration = endTime - startTime;

  const raw = transcript.segments.filter((seg) => {
    return seg.end > startTime && seg.start < endTime;
  });

  if (raw.length === 0) {
    console.warn(`   ⚠️  NormalizerWorker: nenhum segmento encontrado para o clipe ${clip.clipIndex}`);
    return { segments: [] };
  }

  const segments = raw.map((seg) => {
    const relStart = Math.max(0, seg.start - startTime);
    const relEnd   = Math.min(clipDuration, seg.end - startTime);

    return {
      start: relStart,
      end:   relEnd,
      text:  cleanText(seg.text),
      words: tokenizeWords(seg.text, relStart, relEnd),
    };
  });

  const valid = segments.filter((s) => s.end > s.start && s.text.length > 0);
  const normalized = splitLongSegments(valid, 6); // máx 6 palavras = 2 linhas × 3 palavras

  return { segments: normalized };
}

function cleanText(text) {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\sáàãâéêíóôõúüçÁÀÃÂÉÊÍÓÔÕÚÜÇ.,!?]/g, "")
    .replace(/\s([.,!?])/g, "$1")
    .toUpperCase();
}

function tokenizeWords(text, segStart, segEnd) {
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const duration = segEnd - segStart;
  const timePerWord = duration / words.length;

  return words.map((word, i) => ({
    word: word.replace(/[.,!?]$/, ""),
    start: segStart + i * timePerWord,
    end:   segStart + (i + 1) * timePerWord,
    punctuation: extractPunctuation(word),
  }));
}

function extractPunctuation(word) {
  const match = word.match(/([.,!?]+)$/);
  return match ? match[1] : "";
}

function splitLongSegments(segments, maxWords = 8) {
  const result = [];

  for (const seg of segments) {
    if (seg.words.length <= maxWords) {
      result.push(seg);
      continue;
    }

    for (let i = 0; i < seg.words.length; i += maxWords) {
      const chunk = seg.words.slice(i, i + maxWords);
      result.push({
        start: chunk[0].start,
        end:   chunk[chunk.length - 1].end,
        text:  chunk.map((w) => w.word + w.punctuation).join(" "),
        words: chunk,
      });
    }
  }

  return result;
}

module.exports = { NormalizerWorker };

