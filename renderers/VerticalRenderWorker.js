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

      // Subamostrar para máx. 12 keyframes — expressões mais curtas,
      // menos risco de rejeição pelo parser do FFmpeg
      const kf = subsampleCropPath(cropPath, 12);

      const cw = kf[0].crop.width;
      const ch = kf[0].crop.height;

      // Construir expressões e escapar vírgulas para o parser do FFmpeg.
      // O FFmpeg usa ',' para separar filtros no -vf; dentro de valores
      // de opções (e.g. x= de crop=) as vírgulas devem ser '\,' para não
      // serem interpretadas como separadores de filtros.
      const xExpr = escapeFilterCommas(buildPiecewiseExpr(kf, p => p.crop.x));
      const yExpr = escapeFilterCommas(buildPiecewiseExpr(kf, p => p.crop.y));

      // A vírgula entre crop e scale NÃO é escapada — é o separador de filtros
      vf = `crop=${cw}:${ch}:${xExpr}:${yExpr},scale=${targetWidth}:${targetHeight}`;

      console.log(`🎯 [VerticalRender] Modo dinâmico — ${kf.length} keyframes (de ${cropPath.length})`);
      console.log(`[VerticalRender] vf (primeiros 300 chars): ${vf.slice(0, 300)}`);

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
      "-crf", "18",
      "-preset", "slow",
      "-profile:v", "high",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "+faststart",
      outputPath
    );

    // Log do comando completo para debug
    console.log("[VerticalRenderWorker] ffmpeg", args.map(a =>
      a.length > 120 ? a.slice(0, 120) + "…" : a
    ).join(" "));

    const ff = spawn("ffmpeg", args);

    let stderrBuf = "";
    ff.stderr.on("data", (d) => { stderrBuf += d.toString(); });

    ff.on("error", reject);

    ff.on("close", (code) => {
      if (code !== 0) {
        // Extrair as últimas linhas relevantes do stderr (evitar flood)
        const tail = stderrBuf.split("\n").slice(-20).join("\n");
        console.error("[VerticalRenderWorker] FFmpeg stderr (últimas 20 linhas):\n" + tail);
        return reject(new Error(`[VerticalRenderWorker] FFmpeg saiu com code ${code}\n${tail}`));
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

/**
 * Escapa vírgulas para o parser interno do FFmpeg.
 * Dentro de um valor de opção de filtro (e.g. o "x" de crop=w:h:x:y),
 * as vírgulas fazem parte das chamadas de função (if, lt, etc.) mas o
 * FFmpeg v3+ trata-as como separadores de filtros se não forem escapadas.
 * A solução correcta é substituir "," por "\," no valor da expressão.
 */
function escapeFilterCommas(expr) {
  return expr.replace(/,/g, "\\,");
}

/**
 * Reduz o cropPath para no máximo maxPoints keyframes uniformemente espaçados,
 * garantindo que o primeiro e último são sempre incluídos.
 */
function subsampleCropPath(cropPath, maxPoints) {
  if (cropPath.length <= maxPoints) return cropPath;

  const result = [cropPath[0]];
  const step   = (cropPath.length - 1) / (maxPoints - 1);

  for (let i = 1; i < maxPoints - 1; i++) {
    result.push(cropPath[Math.round(i * step)]);
  }

  result.push(cropPath[cropPath.length - 1]);
  return result;
}

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
