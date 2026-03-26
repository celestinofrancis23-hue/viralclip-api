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

  console.log("⚠️ [AudioTranscriber] Usando python3 global");
  return "python3";
}

module.exports = async function audioTranscriber({
  audioPath,
  jobId,
  jobDir,
}) {
  return new Promise((resolve, reject) => {
    try {
      if (!audioPath || !fs.existsSync(audioPath)) {
        throw new Error("[AudioTranscriber] Áudio inválido");
      }

      fs.mkdirSync(jobDir, { recursive: true });

      const transcriptPath = path.join(
        jobDir,
        `${path.basename(audioPath)}.json`
      );

      console.log("🎧 Transcrevendo:", audioPath);

      const pythonBinary = resolvePythonBinary();

      const pythonCode = `
import os
os.environ["OMP_NUM_THREADS"] = "1"

from faster_whisper import WhisperModel
import json

try:
    model = WhisperModel(
        "tiny",
        device="cpu",
        compute_type="int8"
    )

    segments, info = model.transcribe(
        r"${audioPath}",
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
        json.dump(output, f)

except Exception as e:
    print("WHISPER_ERROR:", str(e))
    exit(1)
`;

      const proc = spawn(pythonBinary, ["-c", pythonCode]);

      let stderr = "";

      proc.stderr.on("data", (d) => {
        stderr += d.toString();
        console.error("⚠️ Whisper:", d.toString());
      });

      proc.on("error", (err) => {
        return reject(new Error("Erro ao iniciar Whisper: " + err.message));
      });

      // ⏱️ TIMEOUT HARD (30s)
      const timeout = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error("Whisper timeout (killed)"));
      }, 30000);

      proc.on("close", (code, signal) => {
        clearTimeout(timeout);

        console.log("🐍 Whisper exit:", code, signal);

        // 🔥 tratamento robusto
        if (code !== 0 || signal === "SIGKILL") {
          return reject(
            new Error(
              `Whisper falhou (code=${code}, signal=${signal})\n${stderr}`
            )
          );
        }

        if (!fs.existsSync(transcriptPath)) {
          return reject(
            new Error("Transcript não foi gerado")
          );
        }

        const transcript = JSON.parse(
          fs.readFileSync(transcriptPath, "utf-8")
        );

        console.log("✅ Transcrição OK");

        resolve({
          transcript,
          transcriptPath,
        });
      });
    } catch (err) {
      reject(err);
    }
  });
};
