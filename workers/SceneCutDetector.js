// workers/SceneCutDetector.js
//
// Detecta cortes de câmera num clip usando o filtro scdet do FFmpeg.
// Retorna timestamps (em segundos, relativos ao clip) onde ocorrem cortes.
//
// Parsing da saída do FFmpeg:
//   [Parsed_scdet_0 @ 0x...] lavfi.scdet.score: 20.12, lavfi.scdet.pts_time: 3.000
//
// Uso:
//   const { cuts } = SceneCutDetector({ videoPath: '/tmp/clip.mp4' });
//   // cuts = [1.25, 4.80, 9.33]

const { spawnSync } = require("child_process");

const DEFAULT_THRESHOLD = 10; // 0-100 — quanto maior, menos sensível

module.exports = function SceneCutDetector({
  videoPath,
  threshold = DEFAULT_THRESHOLD,
}) {
  if (!videoPath) return { cuts: [] };

  // Correr FFmpeg apenas para análise — sem output de vídeo (-f null)
  const result = spawnSync(
    "ffmpeg",
    [
      "-i",  videoPath,
      "-vf", `scdet=threshold=${threshold}`,
      "-an",
      "-f",  "null",
      "-",
    ],
    { encoding: "utf8", timeout: 30_000 }
  );

  // scdet escreve para stderr
  const output = result.stderr || "";

  const cuts = [];

  // Formato actual do FFmpeg (v4+):
  //   lavfi.scdet.score: 14.5, lavfi.scdet.pts_time: 2.500
  // Formato alternativo em versões mais antigas:
  //   Parsed_scdet ... pts_time:2.500
  const patterns = [
    /lavfi\.scdet\.pts_time:\s*([\d.]+)/g,
    /pts_time:([\d.]+)/g,
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(output)) !== null) {
      const t = parseFloat(m[1]);
      if (!isNaN(t) && !cuts.includes(t)) {
        cuts.push(t);
      }
    }
    if (cuts.length) break; // parar no primeiro padrão que deu resultados
  }

  cuts.sort((a, b) => a - b);

  if (cuts.length) {
    console.log(`✂️  [SceneCutDetector] ${cuts.length} cortes detectados:`, cuts.map(t => t.toFixed(2) + "s").join(", "));
  } else {
    console.log(`✂️  [SceneCutDetector] Sem cortes detectados (threshold=${threshold})`);
  }

  return { cuts };
};
