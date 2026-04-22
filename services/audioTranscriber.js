const { spawn, spawnSync } = require("child_process");
const fs   = require("fs");
const path = require("path");

// ── Thresholds ────────────────────────────────────────────────────────────────
const VAD_THRESHOLD_S        = 5 * 60;    // activar VAD para áudios > 5 min
const API_THRESHOLD_S        = 20 * 60;   // usar OpenAI API para voz > 20 min
const LONG_AUDIO_THRESHOLD_S = 10 * 60;   // comprimir para mono 16kHz se > 10 min
const API_CHUNK_S            = 20 * 60;   // chunkar API em blocos de 20 min
const API_CHUNK_MAX_BYTES    = 24_000_000; // 24MB — margem abaixo do limite de 25MB da API

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

// ── runVadPreprocessor ────────────────────────────────────────────────────────
// Chama scripts/vad_preprocessor.py e devolve o conteúdo do vad_segments.json.
// Devolve null se VAD falhar (o transcriber continua sem VAD como fallback).
function runVadPreprocessor(audioPath, jobDir) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, "..", "scripts", "vad_preprocessor.py");
    const vadDir     = path.join(jobDir, "vad");
    ensureDir(vadDir);

    console.log("🎙️  [VAD] A executar pré-processador...");

    const proc = spawn(resolvePythonBinary(), [scriptPath, audioPath, vadDir], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", d => { stdout += d; console.log("[VAD]", d.toString().trim()); });
    proc.stderr.on("data", d => { stderr += d; console.error("[VAD stderr]", d.toString().trim()); });

    const timer = setTimeout(() => {
      try { proc.kill("SIGKILL"); } catch (_) {}
      console.warn("⚠️  [VAD] Timeout — a prosseguir sem VAD");
      resolve(null);
    }, 5 * 60 * 1000); // 5 min timeout para VAD

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        console.warn(`⚠️  [VAD] Saiu com code=${code} — a prosseguir sem VAD`);
        return resolve(null);
      }
      const jsonPath = path.join(vadDir, "vad_segments.json");
      if (!fileExistsAndHasSize(jsonPath, 10)) {
        console.warn("⚠️  [VAD] JSON não gerado — a prosseguir sem VAD");
        return resolve(null);
      }
      try {
        const result = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        console.log(`✅ [VAD] ${result.segment_count} segmentos, ${Math.round(result.total_voice_duration)}s de voz (${result.method})`);
        resolve(result);
      } catch (e) {
        console.warn("⚠️  [VAD] Falha a ler JSON:", e.message);
        resolve(null);
      }
    });
  });
}

// ── remapTranscript ───────────────────────────────────────────────────────────
// Converte timestamps do áudio concatenado de volta para o áudio original.
// segments: [{concat_start, concat_end, original_start, original_end}]
function remapTimestamp(t, segments) {
  for (const seg of segments) {
    if (t >= seg.concat_start && t <= seg.concat_end) {
      return seg.original_start + (t - seg.concat_start);
    }
  }
  // Fora de todos os segmentos — mapear para o fim do último
  const last = segments[segments.length - 1];
  return last.original_start + (t - last.concat_start);
}

function remapTranscript(transcript, vadSegments) {
  if (!vadSegments || !Array.isArray(vadSegments.segments) || !vadSegments.segments.length) {
    return transcript;
  }
  const segs = vadSegments.segments;
  return {
    ...transcript,
    segments: transcript.segments.map(seg => ({
      ...seg,
      start: remapTimestamp(seg.start, segs),
      end:   remapTimestamp(seg.end, segs),
      words: (seg.words || []).map(w => ({
        ...w,
        start: remapTimestamp(w.start, segs),
        end:   remapTimestamp(w.end, segs),
      })),
    })),
  };
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
// Usa OpenAI Whisper API para áudio > 60 min (mais robusto para ficheiros longos).
// Chunk em blocos de API_CHUNK_S segundos, depois funde os transcripts.
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

  // Determinar se precisa de chunking
  const needsChunking = fileSizeBytes > API_CHUNK_MAX_BYTES;
  const allSegments = [];

  if (!needsChunking) {
    // Ficheiro único
    const resp = await openai.audio.transcriptions.create({
      file:                   fs.createReadStream(workPath),
      model:                  "whisper-1",
      response_format:        "verbose_json",
      timestamp_granularities: ["word", "segment"],
    });
    (resp.segments || []).forEach(s => allSegments.push(s));
  } else {
    // Dividir em chunks de API_CHUNK_S segundos
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

      // Adicionar offset do chunk aos timestamps
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

  const audioBaseName  = path.basename(audioPath, path.extname(audioPath));
  const transcriptPath = path.join(jobDir, `${audioBaseName}.json`);
  const rawDuration    = getAudioDuration(audioPath);
  const timeoutMs      = Number(process.env.WHISPER_TIMEOUT_MS) > 0
    ? Number(process.env.WHISPER_TIMEOUT_MS)
    : 600_000; // 10 min

  console.log(`🎧 [Transcriber] jobId=${jobId || "N/A"} duração=${Math.round(rawDuration)}s`);

  // ── 1. VAD para áudios longos ─────────────────────────────────────────────
  let vadResult   = null;
  let audioToUse  = audioPath;

  if (rawDuration >= VAD_THRESHOLD_S) {
    console.log(`🎙️  [Transcriber] Duração ≥ ${VAD_THRESHOLD_S / 60}min — a executar VAD...`);
    vadResult = await runVadPreprocessor(audioPath, jobDir);

    if (vadResult && vadResult.voice_audio_path && fs.existsSync(vadResult.voice_audio_path)) {
      audioToUse = vadResult.voice_audio_path;
      console.log(`✅ [Transcriber] A usar áudio VAD (${Math.round(vadResult.total_voice_duration)}s de voz)`);
    } else {
      console.warn("⚠️  [Transcriber] VAD falhou — a usar áudio original comprimido");
      audioToUse = compressAudioIfNeeded(audioPath, jobDir);
    }
  } else {
    // Sem VAD: apenas comprimir se necessário
    audioToUse = compressAudioIfNeeded(audioPath, jobDir);
  }

  const voiceDuration = vadResult ? vadResult.total_voice_duration : getAudioDuration(audioToUse);
  console.log(`⏱️  [Transcriber] Áudio efectivo para Whisper: ${Math.round(voiceDuration)}s`);

  // ── 2. Transcrição: local ou API ──────────────────────────────────────────
  let transcript;

  if (voiceDuration >= API_THRESHOLD_S) {
    console.log(`🌐 [Transcriber] ${Math.round(voiceDuration)}s ≥ ${API_THRESHOLD_S / 60}min — a usar OpenAI Whisper API`);
    transcript = await transcribeWithOpenAIAPI(audioToUse, transcriptPath);
  } else {
    console.log(`💻 [Transcriber] ${Math.round(voiceDuration)}s < ${API_THRESHOLD_S / 60}min — a usar Whisper local (tiny)`);
    transcript = await transcribeLocalWhisper({
      audioPath:      audioToUse,
      transcriptPath,
      pythonBinary:   resolvePythonBinary(),
      timeoutMs,
    });
  }

  if (!transcript || !Array.isArray(transcript.segments)) {
    throw new Error("[Transcriber] Transcript em formato inválido");
  }

  // ── 3. Remapear timestamps VAD → vídeo original ───────────────────────────
  if (vadResult && vadResult.segments && vadResult.segments.length) {
    console.log("🗺️  [Transcriber] A remapear timestamps VAD → vídeo original...");
    transcript = remapTranscript(transcript, vadResult);
    // Regravar com timestamps corrigidos
    fs.writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2), "utf-8");
  }

  console.log(`✅ [Transcriber] Transcrição concluída — ${transcript.segments.length} segmentos`);

  return { transcript, transcriptPath };
};
