const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function resolvePythonBinary() {
  const projectRoot = path.join(__dirname, "..");
  const venvPython = path.join(projectRoot, ".venv", "bin", "python");

  if (fs.existsSync(venvPython)) {
    console.log("🐍 [AudioTranscriber] Usando Python da .venv");
    return venvPython;
  }

  console.log("⚠️ [AudioTranscriber] .venv não encontrada. Usando python3 global.");
  return "python3";
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function escapePythonString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function fileExistsAndHasSize(filePath, minBytes = 10) {
  if (!fs.existsSync(filePath)) return false;

  const stats = fs.statSync(filePath);
  return stats.size >= minBytes;
}

module.exports = async function audioTranscriber({
  audioPath,
  jobId,
  jobDir,
}) {
  return new Promise((resolve, reject) => {
    let finished = false;
    let timeoutId = null;
    let proc = null;

    const safeReject = (err) => {
      if (finished) return;
      finished = true;

      if (timeoutId) clearTimeout(timeoutId);

      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const safeResolve = (value) => {
      if (finished) return;
      finished = true;

      if (timeoutId) clearTimeout(timeoutId);

      resolve(value);
    };

    try {
      if (!audioPath) {
        throw new Error("[AudioTranscriber] audioPath não informado");
      }

      if (!fs.existsSync(audioPath)) {
        throw new Error(`[AudioTranscriber] Áudio não encontrado: ${audioPath}`);
      }

      if (!jobDir) {
        throw new Error("[AudioTranscriber] jobDir não informado");
      }

      ensureDir(jobDir);

      const audioBaseName = path.basename(audioPath, path.extname(audioPath));
      const transcriptPath = path.join(jobDir, `${audioBaseName}.json`);
      const pythonBinary = resolvePythonBinary();

      const timeoutMs =
        Number(process.env.WHISPER_TIMEOUT_MS) > 0
          ? Number(process.env.WHISPER_TIMEOUT_MS)
          : 180000; // 3 minutos

      console.log("🎧 [AudioTranscriber] Iniciando transcrição...");
      console.log("🎵 [AudioTranscriber] Áudio:", audioPath);
      console.log("📄 [AudioTranscriber] Transcript path:", transcriptPath);
      console.log("⏱️ [AudioTranscriber] Timeout(ms):", timeoutMs);
      console.log("🆔 [AudioTranscriber] JobId:", jobId || "N/A");

      const safeAudioPath = escapePythonString(audioPath);
      const safeTranscriptPath = escapePythonString(transcriptPath);

      const pythonCode = `
import os
import sys
import json
import traceback

os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

from faster_whisper import WhisperModel

audio_path = "${safeAudioPath}"
transcript_path = "${safeTranscriptPath}"

try:
    print("PY_START")
    print(f"PY_AUDIO={audio_path}")

    model = WhisperModel(
        "tiny",
        device="cpu",
        compute_type="int8",
        cpu_threads=1
    )

    segments, info = model.transcribe(
        audio_path,
        task="transcribe",
        beam_size=1,
        best_of=1,
        word_timestamps=True,
        vad_filter=True
    )

    output = {
        "language": getattr(info, "language", None),
        "segments": []
    }

    count = 0
    for seg in segments:
        words = []
        if seg.words:
            for w in seg.words:
                words.append({
                    "word": (w.word or "").strip(),
                    "start": float(w.start),
                    "end": float(w.end),
                    "probability": float(w.probability)
                })
        output["segments"].append({
            "start": float(seg.start),
            "end": float(seg.end),
            "text": (seg.text or "").strip(),
            "words": words
        })
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

      proc = spawn(pythonBinary, ["-c", pythonCode], {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          OMP_NUM_THREADS: "1",
          OPENBLAS_NUM_THREADS: "1",
          MKL_NUM_THREADS: "1",
          VECLIB_MAXIMUM_THREADS: "1",
          NUMEXPR_NUM_THREADS: "1",
        },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        const text = data.toString();
        stdout += text;
        console.log("[WHISPER STDOUT]", text.trim());
      });

      proc.stderr.on("data", (data) => {
        const text = data.toString();
        stderr += text;
        console.error("[WHISPER STDERR]", text.trim());
      });

      proc.on("error", (err) => {
        safeReject(
          new Error("[AudioTranscriber] Erro ao iniciar Python/Whisper: " + err.message)
        );
      });

      timeoutId = setTimeout(() => {
        if (finished) return;

        console.error(`❌ [AudioTranscriber] Timeout atingido após ${timeoutMs}ms. Matando Whisper...`);

        try {
          proc.kill("SIGKILL");
        } catch (_) {}

        safeReject(
          new Error(
            `[AudioTranscriber] Whisper timeout (${timeoutMs}ms). Processo encerrado.\nSTDERR:\n${stderr || "vazio"}`
          )
        );
      }, timeoutMs);

      proc.on("close", (code, signal) => {
        if (finished) return;

        console.log("🐍 [AudioTranscriber] Whisper exit:", { code, signal });

        if (signal === "SIGKILL" || signal === "SIGTERM") {
          return safeReject(
            new Error(
              `[AudioTranscriber] Whisper foi morto pelo sistema/process manager (signal=${signal}).\nSTDERR:\n${stderr || "vazio"}`
            )
          );
        }

        if (code !== 0) {
          return safeReject(
            new Error(
              `[AudioTranscriber] Whisper falhou com code=${code}.\nSTDERR:\n${stderr || "vazio"}\nSTDOUT:\n${stdout || "vazio"}`
            )
          );
        }

        if (!fileExistsAndHasSize(transcriptPath, 20)) {
          return safeReject(
            new Error(
              `[AudioTranscriber] Transcript não foi gerado ou está vazio: ${transcriptPath}`
            )
          );
        }

        let transcript;
        try {
          transcript = JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));
        } catch (err) {
          return safeReject(
            new Error(
              `[AudioTranscriber] Falha ao ler JSON do transcript: ${err.message}`
            )
          );
        }

        if (!transcript || !Array.isArray(transcript.segments)) {
          return safeReject(
            new Error("[AudioTranscriber] Transcript gerado em formato inválido")
          );
        }

        console.log("✅ [AudioTranscriber] Transcrição concluída");
        console.log("🧩 [AudioTranscriber] Segments:", transcript.segments.length);

        return safeResolve({
          transcript,
          transcriptPath,
        });
      });
    } catch (err) {
      safeReject(err);
    }
  });
};
