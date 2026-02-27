/**
 * AudioAnalyzer V2
 * ----------------
 * Analisa áudio e gera eventos de interesse baseados em:
 * - Mudança de energia (delta)
 * - Pausas (silêncio relativo)
 * - Ritmo da fala
 * - Fallback automático (nunca retorna vazio)
 */

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");

const execAsync = util.promisify(exec);

module.exports = async function AudioAnalyzer({
  audioPath,
  jobId,
  options = {}
}) {
  if (!audioPath || !fs.existsSync(audioPath)) {
    throw new Error("[AudioAnalyzer] Audio file not found");
  }

  // ============================
  // Configurações (ajustáveis)
  // ============================
  const {
    windowSize = 0.5,          // segundos
    energyDeltaThreshold = 0.35,
    silenceThreshold = -35,    // dB
    minEventGap = 2,           // segundos
    fallbackSegment = 30       // segundos
  } = options;

  console.log(`🎧 [AudioAnalyzer] Analisando áudio (${jobId})`);

  const analysisFile = path.join(
    path.dirname(audioPath),
    "audio_analysis.log"
  );

  // ============================
  // FFmpeg: energia + silêncio
  // ============================
  const cmd = `
    ffmpeg -i "${audioPath}" \
    -af "astats=metadata=1:reset=1,silencedetect=noise=${silenceThreshold}dB:d=0.3" \
    -f null - 2> "${analysisFile}"
  `;

  await execAsync(cmd);

  const raw = fs.readFileSync(analysisFile, "utf-8");
  const parsed = parseFFmpegOutput(raw);

  const duration = parsed.duration || 0;

  let events = [];

  // ============================
  // 1️⃣ Mudança de energia
  // ============================
  for (let i = 1; i < parsed.energy.length; i++) {
    const prev = parsed.energy[i - 1];
    const curr = parsed.energy[i];

    const delta = Math.abs(curr.value - prev.value);

    if (delta >= energyDeltaThreshold) {
      events.push({
        time: curr.time,
        score: clamp(delta, 0, 1),
        reason: "energy_change"
      });
    }
  }

  // ============================
  // 2️⃣ Pausas (silêncio)
  // ============================
  for (const pause of parsed.silences) {
    events.push({
      time: pause.start,
      score: 0.7,
      reason: "pause_detected"
    });
  }

  // ============================
  // 3️⃣ Normalização e limpeza
  // ============================
  events = normalizeEvents(events, minEventGap);

  // ============================
  // 4️⃣ Fallback (OBRIGATÓRIO)
  // ============================
  let fallbackUsed = false;

  if (events.length === 0 && duration > 0) {
    fallbackUsed = true;

    for (let t = fallbackSegment; t < duration; t += fallbackSegment) {
      events.push({
        time: t,
        score: 0.5,
        reason: "fallback_segment"
      });
    }
  }

  console.log(`✅ [AudioAnalyzer] ${events.length} eventos detectados`);

  return {
    jobId,
    duration,
    audioEvents: events,
    fallbackUsed
  };
};

// ======================================================
// Helpers
// ======================================================

function parseFFmpegOutput(text) {
  const lines = text.split("\n");

  let duration = 0;
  let energy = [];
  let silences = [];

  for (const line of lines) {
    if (line.includes("Duration:")) {
      duration = parseTime(line.split("Duration:")[1].split(",")[0]);
    }

    if (line.includes("RMS level dB")) {
      const match = line.match(/pts_time:(\d+(\.\d+)?).*RMS level dB:\s*(-?\d+(\.\d+)?)/);
      if (match) {
        energy.push({
          time: parseFloat(match[1]),
          value: normalizeDb(parseFloat(match[3]))
        });
      }
    }

    if (line.includes("silence_start")) {
      const t = parseFloat(line.split("silence_start:")[1]);
      silences.push({ start: t });
    }
  }

  return { duration, energy, silences };
}

function parseTime(t) {
  const parts = t.trim().split(":").map(Number);
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function normalizeDb(db) {
  // converte dB negativo em 0–1
  return clamp((db + 60) / 60, 0, 1);
}

function normalizeEvents(events, minGap) {
  events.sort((a, b) => a.time - b.time);

  const filtered = [];
  let lastTime = -Infinity;

  for (const e of events) {
    if (e.time - lastTime >= minGap) {
      filtered.push(e);
      lastTime = e.time;
    }
  }

  return filtered;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
