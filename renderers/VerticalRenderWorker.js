// renderers/VerticalRenderWorker.js
//
// Renderer de produção para clips verticais (9:16).
// Suporta dois modos:
//   - cropPath[]  → tracking dinâmico frame a frame (cameraman mode)
//   - segments[]  → crop estático do primeiro segmento (legacy)

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

module.exports = async function VerticalRenderWorker({
  inputPath,
  outputPath,
  // modo dinâmico
  cropPath,
  // modo legacy (estático)
  segments,
  // parâmetros de saída
  targetWidth  = 1080,
  targetHeight = 1920,
  fps          = 30,
  start        = 0,
  end,
}) {
  return new Promise((resolve, reject) => {
    if (!inputPath || !outputPath) {
      return reject(new Error("[VerticalRenderWorker] inputPath ou outputPath inválido"));
    }

    // ─── Escolher modo de crop ─────────────────────────────────────────────
    let vf;
    let duration;

    const hasDynamicCrop = Array.isArray(cropPath) && cropPath.length > 0;
    const hasLegacyCrop  = Array.isArray(segments)  && segments.length > 0;

    if (hasDynamicCrop) {
      // ── Modo dinâmico: tracking de rosto ──────────────────────────────
      const startTime = cropPath[0].time;
      const endTime   = cropPath[cropPath.length - 1].time;
      duration = end != null ? (end - start) : (endTime - startTime);

      const xExpr = buildPiecewiseExpr(cropPath, p => p.crop.x);
      const yExpr = buildPiecewiseExpr(cropPath, p => p.crop.y);
      const cw    = cropPath[0].crop.width;
      const ch    = cropPath[0].crop.height;

      vf = [
        `crop=${cw}:${ch}:${xExpr}:${yExpr}`,
        `scale=${targetWidth}:${targetHeight}:flags=lanczos`
      ].join(",");

      console.log(`🎯 [VerticalRender] Modo dinâmico — ${cropPath.length} keyframes`);

    } else if (hasLegacyCrop) {
      // ── Modo legado: crop estático ────────────────────────────────────
      const seg = segments[0];
      duration  = Math.max(0.1, seg.end - seg.start);

      vf = [
        `crop=${seg.cropWidth}:${seg.cropHeight}:${seg.cropX}:${seg.cropY}`,
        `scale=${targetWidth}:${targetHeight}`,
        `zoompan=z='min(1.05,1+0.0005*n)':d=1`
      ].join(",");

      console.log(`📐 [VerticalRender] Modo legado — crop estático`);

    } else {
      // ── Fallback: crop central simples ────────────────────────────────
      duration = end != null ? (end - start) : null;

      vf = [
        `crop=ih*9/16:ih:(iw-ih*9/16)/2:0`,
        `scale=${targetWidth}:${targetHeight}`
      ].join(",");

      console.log(`⚠️  [VerticalRender] Fallback — crop central simples`);
    }

    // ─── Construir argumentos FFmpeg ──────────────────────────────────────
    const args = [
      "-y",
      "-ss", String(start),
      "-i", inputPath,
    ];

    if (duration != null) {
      args.push("-t", String(duration));
    }

    args.push(
      "-vf", vf,
      "-r", String(fps),
      "-map", "0:v:0",
      "-map", "0:a:0?",
      "-c:v", "libx264",
      "-preset", "fast",
      "-profile:v", "high",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      outputPath
    );

    const ff = spawn("ffmpeg", args);

    ff.stderr.on("data", () => {}); // silêncio — activar em debug

    ff.on("error", reject);

    ff.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error("[VerticalRenderWorker] FFmpeg falhou"));
      }

      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1000) {
        return reject(new Error("[VerticalRenderWorker] MP4 inválido gerado"));
      }

      resolve({ outputPath });
    });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
//  Expressão de interpolação linear por peças (mesma lógica do engine)
// ─────────────────────────────────────────────────────────────────────────────

function buildPiecewiseExpr(cropPath, getValue) {
  const pts = cropPath;

  if (pts.length === 1) return String(getValue(pts[0]));

  let expr = String(getValue(pts[pts.length - 1]));

  for (let i = pts.length - 2; i >= 0; i--) {
    const t0 = pts[i].time;
    const t1 = pts[i + 1].time;
    const v0 = getValue(pts[i]);
    const v1 = getValue(pts[i + 1]);
    const dt = t1 - t0;

    let segExpr;

    if (dt <= 0 || v0 === v1) {
      segExpr = String(v0);
    } else {
      const slope = (v1 - v0) / dt;
      segExpr = slope >= 0
        ? `(${v0}+${slope.toFixed(4)}*(t-${t0}))`
        : `(${v0}${slope.toFixed(4)}*(t-${t0}))`;
    }

    expr = `if(lt(t,${t1.toFixed(3)}),${segExpr},${expr})`;
  }

  return expr;
}
