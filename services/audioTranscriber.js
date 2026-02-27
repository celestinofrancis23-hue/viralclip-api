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

module.exports = async function audioTranscriber({
  audioPath,
  jobId,
  jobDir,
}) {
  return new Promise((resolve, reject) => {
    try {
      // ============================
      // 1. Validação
      // ============================
      if (!audioPath) {
        throw new Error("[AudioTranscriber] audioPath não informado");
      }

      if (!fs.existsSync(audioPath)) {
        throw new Error(
          "[AudioTranscriber] Arquivo de áudio não encontrado: " + audioPath
        );
      }

      if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
      }

      console.log("🎧 [AudioTranscriber] Iniciando transcrição (FASTER-WHISPER)...");
      console.log("🎵 Áudio:", audioPath);

      const baseName = path.basename(audioPath, path.extname(audioPath));
      const transcriptPath = path.join(jobDir, `${baseName}.json`);

      const pythonBinary = resolvePythonBinary();

      // ============================
      // 2. Script Python
      // ============================
      const pythonCode = `
from faster_whisper import WhisperModel
import json
import math
import wave
import contextlib

def audio_duration(path):
    with contextlib.closing(wave.open(path,'r')) as f:
        frames = f.getnframes()
        rate = f.getframerate()
        return frames / float(rate)

duration = audio_duration(r"${audioPath}")
estimated_segments = max(1, math.ceil(duration / 2))

model = WhisperModel(
    "small",
    device="auto",
    compute_type="int8"
)

segments, info = model.transcribe(
    r"${audioPath}",
    task="transcribe",
    word_timestamps=False
)

output = {
    "language": info.language,
    "segments": []
}

for seg in segments:
    output["segments"].append({
        "start": seg.start,
        "end": seg.end,
        "text": seg.text
    })

with open(r"${transcriptPath}", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)
`;

      // ============================
      // 3. Spawn com ambiente correto
      // ============================
      const whisperProcess = spawn(pythonBinary, ["-c", pythonCode], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      whisperProcess.stderr.on("data", (data) => {
        console.error("⚠️ [Faster-Whisper]", data.toString().trim());
      });

      whisperProcess.on("error", (err) => {
        reject(
          new Error(
            "[AudioTranscriber] Erro ao iniciar Faster-Whisper: " + err.message
          )
        );
      });

      whisperProcess.on("close", (code) => {
        if (code !== 0) {
          return reject(
            new Error(
              "[AudioTranscriber] Faster-Whisper finalizou com erro. Código: " +
                code
            )
          );
        }

        if (!fs.existsSync(transcriptPath)) {
          return reject(
            new Error(
              "[AudioTranscriber] Transcript JSON não encontrado: " +
                transcriptPath
            )
          );
        }

        const transcript = JSON.parse(
          fs.readFileSync(transcriptPath, "utf-8")
        );

        if (Array.isArray(transcript.segments)) {
          console.log("\n📝 Transcrição:");
          transcript.segments.forEach((seg) => {
            const start = seg.start.toFixed(2);
            const end = seg.end.toFixed(2);
            const text = seg.text.trim();
            if (text) {
              console.log(`[${start} → ${end}] ${text}`);
            }
          });
          console.log("🧾 Fim da transcrição\n");
        }

        console.log("✅ [AudioTranscriber] Transcrição concluída");
        console.log("📄 Transcript:", transcriptPath);

        resolve({
          transcriptPath,
        });
      });
    } catch (err) {
      reject(err);
    }
  });
};
