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
      if (!audioPath) {
        throw new Error("[AudioTranscriber] audioPath não informado");
      }

      if (!fs.existsSync(audioPath)) {
        throw new Error("[AudioTranscriber] Arquivo de áudio não encontrado: " + audioPath);
      }

      if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
      }

      console.log("🎧 [AudioTranscriber] Iniciando transcrição...");
      console.log("🎵 Áudio:", audioPath);

      const baseName = path.basename(audioPath, path.extname(audioPath));
      const transcriptPath = path.join(jobDir, `${baseName}.json`);

      const pythonBinary = resolvePythonBinary();

      // 🔥 PYTHON CORRIGIDO
      const pythonCode = `
from faster_whisper import WhisperModel
import json
import sys

try:
    model = WhisperModel("small", device="cpu", compute_type="int8")

    segments, info = model.transcribe(
        r"${audioPath}",
        task="transcribe"
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

    print("TRANSCRIPTION_OK")

except Exception as e:
    print("ERROR:", str(e))
    sys.exit(1)
`;

      const proc = spawn(pythonBinary, ["-c", pythonCode], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      // 🔥 DEBUG COMPLETO
      proc.stdout.on("data", (data) => {
        console.log("[WHISPER STDOUT]", data.toString());
      });

      proc.stderr.on("data", (data) => {
        console.error("[WHISPER STDERR]", data.toString());
      });

      proc.on("error", (err) => {
        reject(new Error("[AudioTranscriber] Falha ao iniciar Python: " + err.message));
      });

      proc.on("close", (code) => {
        console.log("🐍 Whisper exit code:", code);

        if (code !== 0) {
          return reject(
            new Error("[AudioTranscriber] Whisper falhou com código: " + code)
          );
        }

        if (!fs.existsSync(transcriptPath)) {
          return reject(
            new Error("[AudioTranscriber] Transcript não foi gerado")
          );
        }

        const transcript = JSON.parse(
          fs.readFileSync(transcriptPath, "utf-8")
        );

        console.log("✅ Transcrição concluída");

        resolve({
          transcriptPath,
        });
      });

    } catch (err) {
      reject(err);
    }
  });
};
