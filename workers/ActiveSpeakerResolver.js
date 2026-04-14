// workers/ActiveSpeakerResolver.js
//
// Cruza a detecção de faces (Haar, pixel coords) com os timestamps
// de fala do Whisper para determinar qual face seguir em cada frame.
//
// Lógica por frame:
//   • Dentro de janela de fala → score: tamanho + centralidade + continuidade
//   • Fora de janela de fala   → manter speaker anterior (câmera não salta)
//   • EMA final suaviza as transições
//
// Output: faceTimeline compatível com CropPathWalker
//   [{time, center:{x,y}, faceBox, confidence, isSpeaking}]
//   (coords normalizadas [0-1])

const EMA_ALPHA       = 0.25;  // suavização do centro — menor = mais lag, mais estável
const MERGE_GAP_S     = 0.6;   // gap de silêncio (s) abaixo do qual duas falas se fundem
const SIZE_WEIGHT     = 0.65;  // peso do tamanho da face no score
const CENTER_WEIGHT   = 0.35;  // peso da centralidade no score
const CONTINUITY_BONUS = 0.25; // bónus adicionado ao score se for o mesmo speaker
const CONTINUITY_DIST  = 0.20; // distância normalizada máxima para "mesmo speaker"
const MIN_FACE_PX      = 20;   // ignorar detecções com w ou h < este valor

module.exports = function ActiveSpeakerResolver({
  faceFrames,          // [{time, faces:[{x,y,w,h,confidence}]}] — pixel coords, clip-relative
  transcriptSegments,  // [{start, end, text, words:[...]}]        — tempo absoluto do vídeo
  videoWidth,
  videoHeight,
  clipStart = 0,       // offset para converter timestamps absolutos em clip-relativos
}) {
  if (!Array.isArray(faceFrames) || !faceFrames.length) {
    return { faceTimeline: [] };
  }

  // ── 1. Janelas de fala (clip-relative, gaps fundidos) ──────────────────────
  const speechWindows = buildSpeechWindows(
    transcriptSegments || [],
    clipStart,
    MERGE_GAP_S
  );

  // ── 2. Seleccionar face activa por frame ───────────────────────────────────
  let emaX             = null;
  let emaY             = null;
  let lastSpeakerPos   = null; // {x, y} normalizado — último speaker conhecido

  const faceTimeline = faceFrames.map(({ time, faces }) => {
    // Filtrar detecções espúrias (muito pequenas)
    const valid = (faces || []).filter(f => f.w >= MIN_FACE_PX && f.h >= MIN_FACE_PX);

    // Sem faces detectadas — manter EMA anterior
    if (!valid.length) {
      const cx = emaX ?? 0.5;
      const cy = emaY ?? 0.3;
      return {
        time,
        center:     { x: round4(cx), y: round4(cy) },
        faceBox:    null,
        confidence: 0,
        isSpeaking: false,
      };
    }

    const isSpeaking = speechWindows.some(w => time >= w.start && time <= w.end);
    const maxArea    = Math.max(...valid.map(f => f.w * f.h));

    let chosen;

    if (valid.length === 1) {
      // Trivial — única face detectada
      chosen = valid[0];

    } else if (isSpeaking) {
      // ── Dentro de janela de fala: score composto ────────────────────────
      chosen = valid.reduce((best, f) => {
        const scoreF    = scoreFace(f, maxArea, videoWidth, videoHeight, lastSpeakerPos);
        const scoreBest = scoreFace(best, maxArea, videoWidth, videoHeight, lastSpeakerPos);
        return scoreF > scoreBest ? f : best;
      });

    } else {
      // ── Silêncio: manter speaker anterior por proximidade ───────────────
      if (lastSpeakerPos) {
        chosen = valid.reduce((best, f) => {
          const dF = distToPos(f, lastSpeakerPos, videoWidth, videoHeight);
          const dB = distToPos(best, lastSpeakerPos, videoWidth, videoHeight);
          return dF < dB ? f : best;
        });
      } else {
        // Sem histórico — escolher o maior
        chosen = valid.reduce((best, f) => f.w * f.h > best.w * best.h ? f : best);
      }
    }

    // Actualizar posição do speaker
    const cx = (chosen.x + chosen.w / 2) / videoWidth;
    const cy = (chosen.y + chosen.h / 2) / videoHeight;
    lastSpeakerPos = { x: cx, y: cy };

    // EMA sobre o centro seleccionado
    if (emaX === null) {
      emaX = cx;
      emaY = cy;
    } else {
      emaX = EMA_ALPHA * cx + (1 - EMA_ALPHA) * emaX;
      emaY = EMA_ALPHA * cy + (1 - EMA_ALPHA) * emaY;
    }

    return {
      time,
      center: {
        x: round4(emaX),
        y: round4(emaY),
      },
      faceBox: {
        x: round4(chosen.x / videoWidth),
        y: round4(chosen.y / videoHeight),
        w: round4(chosen.w / videoWidth),
        h: round4(chosen.h / videoHeight),
      },
      confidence: chosen.confidence || 1,
      isSpeaking,
    };
  });

  return { faceTimeline };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score de uma face durante fala.
 * Combina tamanho normalizado + centralidade + bónus de continuidade.
 */
function scoreFace(f, maxArea, videoWidth, videoHeight, lastSpeakerPos) {
  const areaNorm = (f.w * f.h) / maxArea;

  // Centralidade: distância ao centro do frame (0 = centro, 1 = canto extremo)
  const cx = (f.x + f.w / 2) / videoWidth;
  const cy = (f.y + f.h / 2) / videoHeight;
  // Diagonal máxima possível = dist(0,0)→(1,1) = √2 ≈ 1.414 → normalizar para [0,1]
  const distCenter  = Math.hypot(cx - 0.5, cy - 0.5) / 0.707;
  const centrality  = 1 - Math.min(distCenter, 1);

  let score = SIZE_WEIGHT * areaNorm + CENTER_WEIGHT * centrality;

  // Bónus de continuidade: se esta face é próxima do speaker anterior
  if (lastSpeakerPos) {
    const d = distToPos(f, lastSpeakerPos, videoWidth, videoHeight);
    if (d < CONTINUITY_DIST) {
      score += CONTINUITY_BONUS * (1 - d / CONTINUITY_DIST);
    }
  }

  return score;
}

/**
 * Distância normalizada entre o centro de uma face e uma posição de referência.
 */
function distToPos(f, pos, videoWidth, videoHeight) {
  const cx = (f.x + f.w / 2) / videoWidth;
  const cy = (f.y + f.h / 2) / videoHeight;
  return Math.hypot(cx - pos.x, cy - pos.y);
}

/**
 * Constrói janelas de fala contínuas a partir dos segmentos do Whisper.
 * Funde segmentos cujo intervalo entre eles é < mergeGap segundos.
 * Os timestamps são convertidos para clip-relativos (subtraindo clipStart).
 */
function buildSpeechWindows(segments, clipStart, mergeGap) {
  const ranges = [];

  for (const seg of segments) {
    const start = (seg.start ?? 0) - clipStart;
    const end   = (seg.end   ?? 0) - clipStart;
    if (end > 0 && end > start) {
      ranges.push({ start: Math.max(0, start), end });
    }
  }

  if (!ranges.length) return [];

  ranges.sort((a, b) => a.start - b.start);

  const merged = [{ ...ranges[0] }];

  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i].start - last.end <= mergeGap) {
      last.end = Math.max(last.end, ranges[i].end);
    } else {
      merged.push({ ...ranges[i] });
    }
  }

  return merged;
}

function round4(v) {
  return Math.round(v * 10000) / 10000;
}
