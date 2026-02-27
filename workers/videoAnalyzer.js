const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");

const execPromise = util.promisify(exec);

/**
 * VideoAnalyzer
 * - Extrai frames
 * - Detecta movimento visual (baixo rigor)
 * - Normaliza eventos visuais
 * - Retorna eventos prontos para o Aggregator
 */
async function VideoAnalyzer({
  videoPath,
  jobId,
  options = {}
}) {
  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error("[VideoAnalyzer] Video file not found");
  }

  /* ===========================
     CONFIGURAÇÃO USER-FRIENDLY
     =========================== */
  const {
    frameInterval = 0.15,     // ~6–7 FPS (bom equilíbrio)
    motionThreshold = 4,      // MUITO sensível (detecta pouco movimento)
    maxGap = 0.5,             // junta movimentos próximos
    minDuration = 0.2         // aceita eventos curtos
  } = options;

  console.log(`🎥 [VideoAnalyzer] Analisando vídeo (${jobId})`);
  console.log(`🎛️  Config: fps=${1 / frameInterval}, threshold=${motionThreshold}`);

  const tmpDir = path.dirname(videoPath);
  const framesDir = path.join(tmpDir, "frames");

  fs.mkdirSync(framesDir, { recursive: true });

  /* ===========================
     1️⃣ EXTRAIR FRAMES
     =========================== */
const extractCmd = `ffmpeg -y -i "${videoPath}" -vf fps=${1 / frameInterval} "${framesDir}/frame_%05d.jpg"`;

  await execPromise(extractCmd);

  const frames = fs.readdirSync(framesDir)
    .filter(f => f.endsWith(".jpg"))
    .sort();

  console.log(`🖼️  Frames extraídos: ${frames.length}`);

  if (frames.length < 2) {
    console.warn("[VideoAnalyzer] Poucos frames, criando evento artificial");
    return buildFallbackEvent(jobId);
  }

  /* ===========================
     2️⃣ DETECTAR MOVIMENTO
     =========================== */
  const rawEvents = [];

  for (let i = 1; i < frames.length; i++) {
    const prev = path.join(framesDir, frames[i - 1]);
    const curr = path.join(framesDir, frames[i]);

    const diffCmd = `
      ffmpeg -i "${prev}" -i "${curr}"
      -filter_complex "blend=all_mode=difference,blackframe=amount=0:threshold=32"
      -f null -
    `;

    try {
      const { stderr } = await execPromise(diffCmd);

      const match = stderr.match(/blackframe.*pblack:(\d+)/);
      const motionScore = match ? parseInt(match[1], 10) : 0;

      if (motionScore >= motionThreshold) {
        rawEvents.push({
          time: i * frameInterval,
          score: motionScore,
          reason: "motion_detected"
        });
      }
    } catch {
      // ignorar erro de frame individual
    }
  }

  console.log(`📊 Eventos brutos detectados: ${rawEvents.length}`);

  /* ===========================
     3️⃣ NORMALIZE VIDEO EVENTS
     =========================== */
  const events = normalizeVideoEvents(
    rawEvents,
    maxGap,
    minDuration
  );

  /* ===========================
     4️⃣ FALLBACK (NUNCA 0)
     =========================== */
  if (events.length === 0) {
    console.warn("[VideoAnalyzer] Nenhum evento forte, gerando fallback inteligente");

    return {
      jobId,
      type: "video",
      events: buildFallbackTimeline(frames.length, frameInterval)
    };
  }

  console.log(`✅ Eventos visuais normalizados: ${events.length}`);

  return {
    jobId,
    type: "video",
    events
  };
}

/* ===========================
   NORMALIZER (EMBUTIDO)
   =========================== */
function normalizeVideoEvents(rawEvents, maxGap, minDuration) {
  if (rawEvents.length === 0) return [];

  const events = [];
  let start = rawEvents[0].time;
  let last = start;
  let score = rawEvents[0].score;

  for (let i = 1; i < rawEvents.length; i++) {
    const curr = rawEvents[i];

    if (curr.time - last <= maxGap) {
      last = curr.time;
      score = Math.max(score, curr.score);
    } else {
      if (last - start >= minDuration) {
        events.push({
          start,
          end: last,
          score,
          reason: "visual_motion"
        });
      }
      start = curr.time;
      last = curr.time;
      score = curr.score;
    }
  }

  if (last - start >= minDuration) {
    events.push({
      start,
      end: last,
      score,
      reason: "visual_motion"
    });
  }

  return events;
}

/* ===========================
   FALLBACKS (ANTI-FRUSTRAÇÃO)
   =========================== */
function buildFallbackEvent(jobId) {
  return {
    jobId,
    type: "video",
    events: [
      {
        start: 0,
        end: 3,
        score: 1,
        reason: "fallback_video"
      }
    ]
  };
}

function buildFallbackTimeline(frameCount, frameInterval) {
  const duration = frameCount * frameInterval;

  return [
    {
      start: Math.max(0, duration * 0.25),
      end: Math.min(duration, duration * 0.45),
      score: 1,
      reason: "fallback_low_motion"
    },
    {
      start: Math.max(0, duration * 0.55),
      end: Math.min(duration, duration * 0.75),
      score: 1,
      reason: "fallback_low_motion"
    }
  ];
}

module.exports = VideoAnalyzer;
