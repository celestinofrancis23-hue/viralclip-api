// workers/verticalCropEngine/analyzers/CropPathWalker.js
//
// Converte a faceTimeline (centros EMA) em keyframes de crop para FFmpeg.
//
// Pipeline:
//   1. Calcular dimensões 9:16
//   2. Centros normalizados → coordenadas px
//   3. SMA cut-aware (não mistura frames de cenas diferentes)
//   4. Dead zone + speed limit com dois modos:
//        - Normal:  MAX_SPEED_PX_S  (movimento lento e deliberado)
//        - Corte:   CUT_SPEED_PX_S  (reposição rápida pós-corte)
//   5. Subamostrar para ≤ MAX_KEYFRAMES (limite da expressão FFmpeg)

// ── Tuning ────────────────────────────────────────────────────────────────────
const MAX_SPEED_PX_S  = 300;   // px/s em movimento normal  — cameraman deliberado
const CUT_SPEED_PX_S  = 2500;  // px/s logo após um corte   — reposição rápida
const CUT_WINDOW_S    = 0.5;   // segundos de "janela rápida" após cada corte
const DEAD_ZONE_PX    = 12;    // px — micro-tremores ignorados
const SMA_WINDOW      = 7;     // janela SMA — mais alto = mais suave
const MAX_KEYFRAMES   = 60;    // limite de keyframes para a expressão FFmpeg

module.exports = function CropPathWalker({
  faceTimeline = [],     // [{time, center:{x,y}}] — coords normalizadas [0-1]
  clipDuration,
  sourceWidth,
  sourceHeight,
  sceneCuts = [],        // [t1, t2, ...] — timestamps de cortes (clip-relativos, seg)
  targetAspect = "9:16"
}) {
  if (!Array.isArray(faceTimeline) || !faceTimeline.length) {
    return buildCenteredCrop(sourceWidth, sourceHeight, clipDuration);
  }

  // ── 1. Dimensões do crop 9:16 ───────────────────────────────────────────────
  const aspectRatio = 9 / 16;
  const cropHeight  = sourceHeight;
  const cropWidth   = Math.round(cropHeight * aspectRatio);
  const maxX        = sourceWidth  - cropWidth;
  const maxY        = sourceHeight - cropHeight;

  // ── 2. Centros normalizados → coordenadas px ────────────────────────────────
  let rawPath = faceTimeline.map(({ time, center }) => {
    let x = center.x * sourceWidth  - cropWidth  / 2;
    let y = center.y * sourceHeight - cropHeight / 2;
    x = clamp(Math.round(x), 0, maxX);
    y = clamp(Math.round(y), 0, maxY);
    return { time, x, y };
  });

  // ── 3. SMA cut-aware (não mistura frames de lados opostos de um corte) ──────
  rawPath = applySMACutAware(rawPath, SMA_WINDOW, sceneCuts);

  // ── 4. Dead zone + speed limit dual-mode ────────────────────────────────────
  const cropPath = [];
  let prev = null;

  for (const pt of rawPath) {
    if (!prev) {
      prev = pt;
      cropPath.push(makeCropKeyframe(pt, cropWidth, cropHeight));
      continue;
    }

    const dt   = pt.time - prev.time;
    const dx   = pt.x   - prev.x;
    const dy   = pt.y   - prev.y;
    const dist = Math.hypot(dx, dy);

    // Verificar se este passo atravessa um corte de câmera
    const crossesCut = sceneCuts.some(c => c > prev.time && c <= pt.time);

    // Perto de um corte: desactivar dead zone para garantir reposição
    if (!crossesCut && dist < DEAD_ZONE_PX) {
      cropPath.push(makeCropKeyframe({ time: pt.time, x: prev.x, y: prev.y }, cropWidth, cropHeight));
      prev = { time: pt.time, x: prev.x, y: prev.y };
      continue;
    }

    // Speed limit: rápido no corte, lento fora
    const inCutWindow = isNearCut(pt.time, sceneCuts, CUT_WINDOW_S);
    const speedLimit  = inCutWindow ? CUT_SPEED_PX_S : MAX_SPEED_PX_S;
    const maxMove     = speedLimit * Math.max(dt, 1 / 30); // mínimo 1 frame

    let finalX = pt.x;
    let finalY = pt.y;

    if (dist > maxMove) {
      const ratio = maxMove / dist;
      finalX = Math.round(prev.x + dx * ratio);
      finalY = Math.round(prev.y + dy * ratio);
    }

    finalX = clamp(finalX, 0, maxX);
    finalY = clamp(finalY, 0, maxY);

    const next = { time: pt.time, x: finalX, y: finalY };
    cropPath.push(makeCropKeyframe(next, cropWidth, cropHeight));
    prev = next;
  }

  // ── 5. Subamostrar para ≤ MAX_KEYFRAMES ────────────────────────────────────
  const subsampledPath = subsample(cropPath, MAX_KEYFRAMES, sceneCuts);

  return { cropPath: subsampledPath };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SMA cut-aware: para cada ponto, a janela de média não inclui pontos
 * do lado oposto de um corte de câmera. Evita pans errados entre cenas.
 */
function applySMACutAware(path, window, sceneCuts) {
  if (window <= 1 || !path.length) return path;

  return path.map((pt, i) => {
    const half = Math.floor(window / 2);
    let lo = Math.max(0, i - half);
    let hi = Math.min(path.length - 1, i + half);

    // Restringir janela para não cruzar nenhum corte
    for (const cut of sceneCuts) {
      // Corte entre lo..i: empurrar lo para depois do corte
      for (let j = lo; j < i; j++) {
        if (path[j].time <= cut && (path[j + 1]?.time ?? Infinity) > cut) {
          lo = j + 1;
          break;
        }
      }
      // Corte entre i..hi: empurrar hi para antes do corte
      for (let j = i; j < hi; j++) {
        if (path[j].time <= cut && (path[j + 1]?.time ?? Infinity) > cut) {
          hi = j;
          break;
        }
      }
    }

    const slice = path.slice(lo, hi + 1);
    const avgX  = slice.reduce((s, p) => s + p.x, 0) / slice.length;
    const avgY  = slice.reduce((s, p) => s + p.y, 0) / slice.length;

    return { time: pt.time, x: Math.round(avgX), y: Math.round(avgY) };
  });
}

/** Retorna true se `time` está dentro de CUT_WINDOW_S a seguir a qualquer corte. */
function isNearCut(time, sceneCuts, windowS) {
  return sceneCuts.some(cut => time >= cut && time < cut + windowS);
}

function makeCropKeyframe({ time, x, y }, width, height) {
  return { time, crop: { x, y, width, height } };
}

/**
 * Subamostrar garantindo que os pontos imediatamente antes e depois de
 * cada corte são sempre incluídos (para que a transição seja correcta).
 */
function subsample(cropPath, maxPoints, sceneCuts) {
  if (cropPath.length <= maxPoints) return cropPath;

  // Pontos âncora: primeiro, último, e flancos de cada corte
  const anchorSet = new Set([0, cropPath.length - 1]);

  for (const cut of sceneCuts) {
    // Frame imediatamente antes e depois do corte
    for (let i = 0; i < cropPath.length; i++) {
      if (cropPath[i].time <= cut && (cropPath[i + 1]?.time ?? Infinity) > cut) {
        anchorSet.add(i);
        if (i + 1 < cropPath.length) anchorSet.add(i + 1);
        break;
      }
    }
  }

  const anchors  = [...anchorSet].sort((a, b) => a - b);
  const budget   = maxPoints - anchors.length;

  if (budget <= 0) {
    return anchors.map(i => cropPath[i]);
  }

  // Distribuir os pontos restantes uniformemente entre os âncoras
  const anchorIdxSet = new Set(anchors);
  const nonAnchors   = cropPath
    .map((_, i) => i)
    .filter(i => !anchorIdxSet.has(i));

  const step     = Math.max(1, Math.floor(nonAnchors.length / budget));
  const selected = new Set(anchors);

  for (let i = 0; i < nonAnchors.length && selected.size < maxPoints; i += step) {
    selected.add(nonAnchors[i]);
  }

  return [...selected]
    .sort((a, b) => a - b)
    .map(i => cropPath[i]);
}

function buildCenteredCrop(sourceWidth, sourceHeight, duration) {
  const cropHeight = sourceHeight;
  const cropWidth  = Math.round(cropHeight * 9 / 16);
  const x          = Math.round((sourceWidth  - cropWidth)  / 2);
  const y          = 0;
  return {
    cropPath: [
      { time: 0,        crop: { x, y, width: cropWidth, height: cropHeight } },
      { time: duration, crop: { x, y, width: cropWidth, height: cropHeight } },
    ]
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
