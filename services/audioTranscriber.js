const { spawn, spawnSync } = require("child_process");
const fs   = require("fs");
const path = require("path");

// ── Thresholds ────────────────────────────────────────────────────────────────
const API_THRESHOLD_S        = 20 * 60;   // usar OpenAI API para áudio > 20 min
const LONG_AUDIO_THRESHOLD_S = 10 * 60;   // comprimir para mono 16kHz se > 10 min
const API_CHUNK_S            = 20 * 60;   // chunkar API em blocos de 20 min
const API_CHUNK_MAX_BYTES    = 24_000_000; // 24MB — margem abaixo do limite de 25MB da API

// Culto de igreja: se > 60 min, ignorar os primeiros 50% (louvor/música)
const CHURCH_CUT_THRESHOLD_S = 60 * 60;  // activar corte se > 60 min
const CHURCH_CUT_RATIO       = 0.5;      // ignorar os primeiros 50%

function resolvePythonBinary() {
  const venvPython = path.join(__dirname, "..", ".venv", "bin", "python");
  if (fs.existsSync(venvPython)) return venvPython;
  return "python3";
}

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

function fileExistsAndHasSize(filePath, minBytes = 10) {
  return fs.existsSync(filePath) && fs.statSync(filePath).size >= minBytes;
}

function escapePythonString(v) {
  return String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// ── cutAudioSecondHalf ────────────────────────────────────────────────────────
function cutAudioSecondHalf(audioPath, startS, jobDir) {
  const out = path.join(jobDir, "audio_second_half.wav");
  const r   = spawnSync("ffmpeg", [
    "-y", "-ss", String(startS), "-i", audioPath,
    "-ac", "1", "-ar", "16000", "-vn", out,
  ], { encoding: "utf8", timeout: 300_000 });

  if (r.status !== 0 || !fs.existsSync(out)) {
    console.warn("⚠️  [Transcriber] Corte da segunda metade falhou — usando áudio completo");
    return { path: audioPath, offset: 0 };
  }

  const durAfter = getAudioDuration(out);
  console.log(`✅ [Transcriber] Corte OK — ${Math.round(durAfter)}s restantes (offset=${Math.round(startS)}s)`);
  return { path: out, offset: startS };
}

// ── applyTimestampOffset ──────────────────────────────────────────────────────
function applyTimestampOffset(transcript, offsetS) {
  return {
    ...transcript,
    segments: transcript.segments.map(seg => ({
      ...seg,
      start: seg.start + offsetS,
      end:   seg.end   + offsetS,
      words: (seg.words || []).map(w => ({
        ...w,
        start: w.start + offsetS,
        end:   w.end   + offsetS,
      })),
    })),
  };
}

// ── getAudioDuration ──────────────────────────────────────────────────────────
function getAudioDuration(filePath) {
  const r = spawnSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ], { encoding: "utf8", timeout: 15_000 });
  const val = parseFloat(r.stdout);
  return isNaN(val) ? 0 : val;
}

// ── compressAudioIfNeeded ─────────────────────────────────────────────────────
function compressAudioIfNeeded(audioPath, jobDir) {
  const duration = getAudioDuration(audioPath);

  if (duration <= LONG_AUDIO_THRESHOLD_S) {
    console.log(`🎵 [Transcriber] ${Math.round(duration)}s — sem compressão`);
    return audioPath;
  }

  console.log(`🗜️  [Transcriber] ${Math.round(duration)}s > ${LONG_AUDIO_THRESHOLD_S}s — a comprimir mono 16kHz...`);
  const out = path.join(jobDir, "audio_compressed.wav");
  const r   = spawnSync("ffmpeg", ["-y", "-i", audioPath, "-ac", "1", "-ar", "16000", "-vn", out], {
    encoding: "utf8", timeout: 120_000,
  });
  if (r.status !== 0 || !fs.existsSync(out)) {
    console.warn("⚠️  [Transcriber] Compressão falhou — usando original");
    return audioPath;
  }
  const origMB = (fs.statSync(audioPath).size / 1048576).toFixed(1);
  const compMB = (fs.statSync(out).size / 1048576).toFixed(1);
  console.log(`✅ [Transcriber] Comprimido: ${origMB}MB → ${compMB}MB`);
  return out;
}

// ── transcribeLocalWhisper ────────────────────────────────────────────────────
function transcribeLocalWhisper({ audioPath, transcriptPath, pythonBinary, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const safeAudio      = escapePythonString(audioPath);
    const safeTranscript = escapePythonString(transcriptPath);

    const pythonCode = `
import os, sys, json, traceback
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
from faster_whisper import WhisperModel
audio_path = "${safeAudio}"
transcript_path = "${safeTranscript}"
try:
    print("PY_START")
    model = WhisperModel("tiny", device="cpu", compute_type="int8", cpu_threads=1)
    segments, info = model.transcribe(
        audio_path, task="transcribe",
        beam_size=1, best_of=1,
        word_timestamps=True, vad_filter=True
    )
    output = {"language": getattr(info, "language", None), "segments": []}
    count = 0
    for seg in segments:
        words = []
        if seg.words:
            for w in seg.words:
                words.append({"word": (w.word or "").strip(), "start": float(w.start),
                              "end": float(w.end), "probability": float(w.probability)})
        output["segments"].append({"start": float(seg.start), "end": float(seg.end),
                                   "text": (seg.text or "").strip(), "words": words})
        count += 1
    with open(transcript_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"PY_DONE segments={count}")
    sys.exit(0)
except Exception as e:
    print("WHISPER_ERROR_START", file=sys.stderr)
    print(str(e), file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    print("WHISPER_ERROR_END", file=sys.stderr)
    sys.exit(1)
`;

    const proc = spawn(pythonBinary, ["-c", pythonCode], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, OMP_NUM_THREADS: "1", OPENBLAS_NUM_THREADS: "1",
             MKL_NUM_THREADS: "1", VECLIB_MAXIMUM_THREADS: "1", NUMEXPR_NUM_THREADS: "1" },
    });

    let stdout = "", stderr = "";
    proc.stdout.on("data", d => { stdout += d; console.log("[WHISPER]", d.toString().trim()); });
    proc.stderr.on("data", d => { stderr += d; console.error("[WHISPER stderr]", d.toString().trim()); });
    proc.on("error", reject);

    const timer = setTimeout(() => {
      try { proc.kill("SIGKILL"); } catch (_) {}
      reject(new Error(`[Transcriber] Whisper timeout (${timeoutMs}ms)\n${stderr.slice(-500)}`));
    }, timeoutMs);

    proc.on("close", (code, signal) => {
      clearTimeout(timer);
      if (signal === "SIGKILL" || signal === "SIGTERM") {
        return reject(new Error(`[Transcriber] Whisper morto (${signal})\n${stderr.slice(-500)}`));
      }
      if (code !== 0) {
        return reject(new Error(`[Transcriber] Whisper code=${code}\n${stderr.slice(-500)}`));
      }
      if (!fileExistsAndHasSize(transcriptPath, 20)) {
        return reject(new Error(`[Transcriber] Transcript vazio: ${transcriptPath}`));
      }
      try {
        resolve(JSON.parse(fs.readFileSync(transcriptPath, "utf-8")));
      } catch (e) {
        reject(new Error(`[Transcriber] JSON inválido: ${e.message}`));
      }
    });
  });
}

// ── transcribeWithOpenAIAPI ───────────────────────────────────────────────────
async function transcribeWithOpenAIAPI(audioPath, transcriptPath) {
  const OpenAI = require("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const duration = getAudioDuration(audioPath);
  console.log(`🌐 [Transcriber] OpenAI Whisper API — ${Math.round(duration)}s de áudio`);

  // Comprimir para MP3 32kbps mono para minimizar tamanho
  const compressedPath = audioPath + ".api.mp3";
  const compR = spawnSync("ffmpeg", [
    "-y", "-i", audioPath,
    "-ac", "1", "-ar", "16000",
    "-codec:a", "libmp3lame", "-b:a", "32k",
    compressedPath,
  ], { encoding: "utf8", timeout: 300_000 });

  const workPath = (compR.status === 0 && fs.existsSync(compressedPath))
    ? compressedPath
    : audioPath;

  const fileSizeBytes = fs.statSync(workPath).size;
  console.log(`📦 [Transcriber] Ficheiro para API: ${(fileSizeBytes / 1048576).toFixed(1)}MB`);

  const needsChunking = fileSizeBytes > API_CHUNK_MAX_BYTES;
  const allSegments = [];

  if (!needsChunking) {
    const resp = await openai.audio.transcriptions.create({
      file:                   fs.createReadStream(workPath),
      model:                  "whisper-1",
      response_format:        "verbose_json",
      timestamp_granularities: ["word", "segment"],
    });
    (resp.segments || []).forEach(s => allSegments.push(s));
  } else {
    const nChunks = Math.ceil(duration / API_CHUNK_S);
    console.log(`📋 [Transcriber] A dividir em ${nChunks} chunks de ${API_CHUNK_S / 60} min...`);

    for (let i = 0; i < nChunks; i++) {
      const chunkStart = i * API_CHUNK_S;
      const chunkDur   = Math.min(API_CHUNK_S, duration - chunkStart);
      const chunkPath  = workPath + `.chunk${i}.mp3`;

      const cr = spawnSync("ffmpeg", [
        "-y", "-ss", String(chunkStart), "-t", String(chunkDur),
        "-i", workPath,
        "-c", "copy",
        chunkPath,
      ], { encoding: "utf8", timeout: 120_000 });

      if (cr.status !== 0 || !fs.existsSync(chunkPath)) {
        console.warn(`⚠️  [Transcriber] Chunk ${i} falhou — a saltar`);
        continue;
      }

      console.log(`🌐 [Transcriber] API chunk ${i + 1}/${nChunks} (${chunkStart}s–${chunkStart + chunkDur}s)`);

      const resp = await openai.audio.transcriptions.create({
        file:                   fs.createReadStream(chunkPath),
        model:                  "whisper-1",
        response_format:        "verbose_json",
        timestamp_granularities: ["word", "segment"],
      });

      (resp.segments || []).forEach(s => {
        allSegments.push({
          ...s,
          start: (s.start || 0) + chunkStart,
          end:   (s.end   || 0) + chunkStart,
          words: (s.words || []).map(w => ({
            ...w,
            start: (w.start || 0) + chunkStart,
            end:   (w.end   || 0) + chunkStart,
          })),
        });
      });

      try { fs.unlinkSync(chunkPath); } catch (_) {}
    }
  }

  if (fs.existsSync(compressedPath)) try { fs.unlinkSync(compressedPath); } catch (_) {}

  const transcript = {
    language: allSegments[0]?.language || null,
    segments: allSegments.map(s => ({
      start: s.start,
      end:   s.end,
      text:  (s.text || "").trim(),
      words: (s.words || []).map(w => ({
        word:        (w.word || "").trim(),
        start:       w.start,
        end:         w.end,
        probability: w.probability || 1,
      })),
    })),
  };

  fs.writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2), "utf-8");
  console.log(`✅ [Transcriber] API → ${transcript.segments.length} segmentos`);
  return transcript;
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
module.exports = async function audioTranscriber({ audioPath, jobId, jobDir }) {
  if (!audioPath) throw new Error("[Transcriber] audioPath obrigatório");
  if (!fs.existsSync(audioPath)) throw new Error(`[Transcriber] Áudio não encontrado: ${audioPath}`);
  if (!jobDir) throw new Error("[Transcriber] jobDir obrigatório");

  ensureDir(jobDir);

  const transcriptPath    = path.join(jobDir, "transcript.json");
  const originalDuration  = getAudioDuration(audioPath);
  const timeoutMs         = Number(process.env.WHISPER_TIMEOUT_MS) > 0
    ? Number(process.env.WHISPER_TIMEOUT_MS)
    : 600_000;

  console.log(`🎧 [Transcriber] jobId=${jobId || "N/A"} duração=${Math.round(originalDuration)}s`);

  // ── 0. Cortar início se vídeo muito longo (culto de igreja) ───────────────
  let timeOffset  = 0;
  let rawDuration = originalDuration;

  if (originalDuration > CHURCH_CUT_THRESHOLD_S) {
    const cutStart = Math.round(originalDuration * CHURCH_CUT_RATIO);
    console.log(
      `✂️  [Transcriber] Vídeo longo (${Math.round(originalDuration / 60)}min) — ` +
      `a ignorar primeiros ${Math.round(cutStart / 60)}min (provável louvor)`
    );
    const cut   = cutAudioSecondHalf(audioPath, cutStart, jobDir);
    audioPath   = cut.path;
    timeOffset  = cut.offset;
    rawDuration = getAudioDuration(audioPath);
    console.log(`⏱️  [Transcriber] Duração após corte: ${Math.round(rawDuration)}s (offset=${Math.round(timeOffset)}s)`);
  }

  // ── 1. Compressão mono 16kHz se necessário ────────────────────────────────
  const audioToUse    = compressAudioIfNeeded(audioPath, jobDir);
  const voiceDuration = getAudioDuration(audioToUse);
  console.log(`⏱️  [Transcriber] Áudio para Whisper: ${Math.round(voiceDuration)}s`);

  // ── 2. Transcrição: local se < 20min, OpenAI API se ≥ 20min ──────────────
  let transcript;

  if (voiceDuration >= API_THRESHOLD_S) {
    console.log(`🌐 [Transcriber] ${Math.round(voiceDuration)}s ≥ ${API_THRESHOLD_S / 60}min — a usar OpenAI Whisper API`);
    transcript = await transcribeWithOpenAIAPI(audioToUse, transcriptPath);
  } else {
    console.log(`💻 [Transcriber] ${Math.round(voiceDuration)}s < ${API_THRESHOLD_S / 60}min — a usar Whisper local (tiny)`);
    transcript = await transcribeLocalWhisper({
      audioPath:    audioToUse,
      transcriptPath,
      pythonBinary: resolvePythonBinary(),
      timeoutMs,
    });
  }

  if (!transcript || !Array.isArray(transcript.segments)) {
    throw new Error("[Transcriber] Transcript em formato inválido");
  }

  // ── 3. Aplicar offset do corte → posição real no vídeo original ──────────
  if (timeOffset > 0) {
    console.log(`⏱️  [Transcriber] A aplicar offset de ${Math.round(timeOffset)}s`);
    transcript = applyTimestampOffset(transcript, timeOffset);
  }

  fs.writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2), "utf-8");
  console.log(`✅ [Transcriber] Transcrição concluída — ${transcript.segments.length} segmentos`);

  return { transcript, transcriptPath };
};
