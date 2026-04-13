// workers/verticalCropEngine/render/VerticalRenderWorker.js
//
// Render final do clip vertical com crop DINÂMICO frame a frame.
// Usa expressões FFmpeg com interpolação linear por peças para
// mover o crop suavemente seguindo o rosto como um cameraman.

const { spawn } = require("child_process");
const path = require("path");

module.exports = function VerticalRenderWorker({
  inputVideoPath,
  outputVideoPath,
  cropPath,
  zoomPath,
  targetWidth  = 1080,
  targetHeight = 1920,
  fps          = 30
}) {
  return new Promise((resolve, reject) => {
    if (!inputVideoPath || !outputVideoPath) {
      return reject(new Error("[VerticalRenderWorker] input ou output inválido"));
    }

    if (!Array.isArray(cropPath) || cropPath.length === 0) {
      return reject(new Error("[VerticalRenderWorker] cropPath vazio ou inválido"));
    }

    if (!Array.isArray(zoomPath)) {
      return reject(new Error("[VerticalRenderWorker] zoomPath inválido"));
    }

    console.log("🎬 VerticalRender dinâmico iniciado");
    console.log("📥 Input:", inputVideoPath);
    console.log("📤 Output:", outputVideoPath);
    console.log("🎯 Keyframes de crop:", cropPath.length);

    const filter = buildDynamicFilter(cropPath, zoomPath, targetWidth, targetHeight);

    const args = [
      "-y",
      "-i", inputVideoPath,
      "-vf", filter,
      "-r", String(fps),
      "-c:v", "libx264",
      "-preset", "fast",
      "-profile:v", "high",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      outputVideoPath
    ];

    const ffmpeg = spawn("ffmpeg", args);

    ffmpeg.stderr.on("data", (data) => {
      // silencia para não poluir logs (activar em debug)
      // process.stdout.write(data.toString());
    });

    ffmpeg.on("error", reject);

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error("[VerticalRenderWorker] ffmpeg falhou"));
      }

      console.log("✅ VerticalRender dinâmico finalizado");
      resolve({ outputVideoPath });
    });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
//  Construção do filtro FFmpeg dinâmico
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Constrói a expressão FFmpeg de crop dinâmico.
 *
 * A expressão usa interpolação linear por peças:
 *   x(t) = if(lt(t, t1), lerp(x0,x1, t), if(lt(t, t2), lerp(x1,x2, t), ...))
 *
 * Isto move o crop suavemente entre os keyframes — como um dolly.
 */
function buildDynamicFilter(cropPath, zoomPath, targetW, targetH) {
  const cw = cropPath[0].crop.width;
  const ch = cropPath[0].crop.height;

  const xExpr = buildPiecewiseExpr(cropPath, p => p.crop.x);
  const yExpr = buildPiecewiseExpr(cropPath, p => p.crop.y);

  const cropFilter  = `crop=${cw}:${ch}:${xExpr}:${yExpr}`;
  const scaleFilter = `scale=${targetW}:${targetH}:flags=lanczos`;

  return [cropFilter, scaleFilter].join(",");
}

/**
 * Gera expressão FFmpeg de interpolação linear por peças para uma coordenada.
 *
 * Usa if() aninhados da direita para a esquerda:
 *   if(lt(t, t1), lerp(x0,x1), if(lt(t, t2), lerp(x1,x2), ..., x_last))
 */
function buildPiecewiseExpr(cropPath, getValue) {
  const pts = cropPath;

  if (pts.length === 1) {
    return String(getValue(pts[0]));
  }

  // base case: último valor (quando t ≥ t_last)
  let expr = String(getValue(pts[pts.length - 1]));

  // construir da direita para a esquerda
  for (let i = pts.length - 2; i >= 0; i--) {
    const t0 = pts[i].time;
    const t1 = pts[i + 1].time;
    const v0 = getValue(pts[i]);
    const v1 = getValue(pts[i + 1]);
    const dt = t1 - t0;

    let segExpr;

    if (dt <= 0 || v0 === v1) {
      // sem interpolação necessária
      segExpr = String(v0);
    } else {
      // lerp(v0, v1, (t - t0) / dt)
      const slope = (v1 - v0) / dt;
      if (slope >= 0) {
        segExpr = `(${v0}+${slope.toFixed(4)}*(t-${t0}))`;
      } else {
        segExpr = `(${v0}${slope.toFixed(4)}*(t-${t0}))`;
      }
    }

    expr = `if(lt(t,${t1.toFixed(3)}),${segExpr},${expr})`;
  }

  return expr;
}
