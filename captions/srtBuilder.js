function secondsToSrtTime(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  const ms = String(Math.floor((seconds % 1) * 1000)).padStart(3, '0');
  return `${h}:${m}:${s},${ms}`;
}

function buildSRT(segments) {
  let srt = '';
  segments.forEach((seg, i) => {
    srt += `${i + 1}\n`;
    srt += `${secondsToSrtTime(seg.start)} --> ${secondsToSrtTime(seg.end)}\n`;
    srt += `${seg.text.trim()}\n\n`;
  });
  return srt;
}

module.exports = buildSRT;
