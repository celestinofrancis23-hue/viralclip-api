// workers/verticalCropEngine/analyzers/CropPathWalker.js
//
// Converte a faceTimeline (centros suavizados) em keyframes de crop para FFmpeg.
// Pipeline:
//   1. Calcular dimensões do crop 9:16
//   2. Converter centro normalizado → coordenadas px do crop
//   3. Aplicar moving average adicional (SMA) sobre as coordenadas px
//   4. Aplicar dead zone para evitar micro-tremor
//   5. Limitar velocidade máxima de movimento (câmera suave)
//   6. Subamostrar para ≤ MAX_KEYFRAMES keyframes (FFmpeg expression limit)

const MAX_SPEED_PX_S  = 600;   // pixels/segundo máximo de deslocação da câmera
const DEAD_ZONE_PX    = 8;     // pixels — movimentos menores ignorados
const SMA_WINDOW      = 5;     // janela do moving average adicional (frames)
const MAX_KEYFRAMES   = 60;    // limite de keyframes para a expressão FFmpeg

module.exports = function CropPathWalker({
  faceTimeline = [],            // [{time, center:{x,y}}] — coords normalizadas
  clipDuration,
  sourceWidth,
  sourceHeight,
  targetAspect = "9:16"
}) {
  if (!Array.isArray(faceTimeline) || !faceTimeline.length) {
    return buildCenteredCrop(sourceWidth, sourceHeight, clipDuration);
  }

  // ─── 1. Dimensões do crop 9:16 ────────────────────────────────────────────
  const aspectRatio = 9 / 16;
  const cropHeight  = sourceHeight;
  const cropWidth   = Math.round(cropHeight * aspectRatio);
  const maxX        = sourceWidth  - cropWidth;
  const maxY        = sourceHeight - cropHeight;

  // ─── 2. Converter centros normalizados → coordenadas de crop (px) ─────────
  let rawPath = faceTimeline.map(({ time, center }) => {
    // O crop é centrado no rosto: o canto superior esquerdo é deslocado meio crop
    let x = center.x * sourceWidth  - cropWidth  / 2;
    let y = center.y * sourceHeight - cropHeight / 2;

    // Clamp dentro dos limites do vídeo
    x = clamp(Math.round(x), 0, maxX);
    y = clamp(Math.round(y), 0, maxY);

    return { time, x, y };
  });

  // ─── 3. Smooth por Simple Moving Average (SMA) ───────────────────────────
  rawPath = applySMA(rawPath, SMA_WINDOW);

  // ─── 4. Dead zone + limitar velocidade ───────────────────────────────────
  const cropPath = [];
  let prev = null;

  for (const pt of rawPath) {
    if (!prev) {
      prev = pt;
      cropPath.push(makeCropKeyframe(pt, cropWidth, cropHeight));
      continue;
    }

    const dt  = pt.time - prev.time;
    const dx  = pt.x   - prev.x;
    const dy  = pt.y   - prev.y;
    const dist = Math.hypot(dx, dy);

    // Dead zone — câmera não se move para tremores pequenos
    if (dist < DEAD_ZONE_PX) {
      cropPath.push(makeCropKeyframe({ time: pt.time, x: prev.x, y: prev.y }, cropWidth, cropHeight));
      prev = { time: pt.time, x: prev.x, y: prev.y };
      continue;
    }

    // Limitar velocidade máxima
    const maxMove = MAX_SPEED_PX_S * dt;
    let finalX = pt.x;
    let finalY = pt.y;

    if (dist > maxMove && maxMove > 0) {
      const ratio = maxMove / dist;
      finalX = Math.round(prev.x + dx * ratio);
      finalY = Math.round(prev.y + dy * ratio);
    }

    // Clamp novamente após limitação de velocidade
    finalX = clamp(finalX, 0, maxX);
    finalY = clamp(finalY, 0, maxY);

    const next = { time: pt.time, x: finalX, y: finalY };
    cropPath.push(makeCropKeyframe(next, cropWidth, cropHeight));
    prev = next;
  }

  // ─── 5. Subamostrar para ≤ MAX_KEYFRAMES ─────────────────────────────────
  const subsampledPath = subsample(cropPath, MAX_KEYFRAMES);

  return { cropPath: subsampledPath };
};

// ─────────────────────────────────────────────────────────────────────────────

function applySMA(path, window) {
  if (window <= 1) return path;

  return path.map((pt, i) => {
    const half  = Math.floor(window / 2);
    const start = Math.max(0, i - half);
    const end   = Math.min(path.length - 1, i + half);
    const slice = path.slice(start, end + 1);

    const avgX = slice.reduce((s, p) => s + p.x, 0) / slice.length;
    const avgY = slice.reduce((s, p) => s + p.y, 0) / slice.length;

    return { time: pt.time, x: Math.round(avgX), y: Math.round(avgY) };
  });
}

function makeCropKeyframe({ time, x, y }, width, height) {
  return {
    time,
    crop: { x, y, width, height }
  };
}

function buildCenteredCrop(sourceWidth, sourceHeight, duration) {
  const cropHeight = sourceHeight;
  const cropWidth  = Math.round(cropHeight * 9 / 16);
  const x          = Math.round((sourceWidth  - cropWidth)  / 2);
  const y          = 0;

  return {
    cropPath: [
      { time: 0,        crop: { x, y, width: cropWidth, height: cropHeight } },
      { time: duration, crop: { x, y, width: cropWidth, height: cropHeight } }
    ]
  };
}

function subsample(cropPath, maxPoints) {
  if (cropPath.length <= maxPoints) return cropPath;

  const result = [cropPath[0]];
  const step   = (cropPath.length - 1) / (maxPoints - 1);

  for (let i = 1; i < maxPoints - 1; i++) {
    result.push(cropPath[Math.round(i * step)]);
  }

  result.push(cropPath[cropPath.length - 1]);
  return result;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
