const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[FaceDetectionWorker] ${label} não encontrado: ${filePath}`);
  }
}

function resolvePythonBinary() {
  // Se existir venv local, usa ela
  const venvPath = path.join(process.cwd(), ".venv", "bin", "python");

  if (fs.existsSync(venvPath)) {
    console.log("🐍 Usando Python da venv:", venvPath);
    return venvPath;
  }

  // Caso contrário, usa python3 global (Docker / Railway)
  console.log("🐍 Usando Python global (python3)");
  return "python3";
}

function FaceDetectionWorker({ videoPath, confidence = 0.5 }) {
  return new Promise((resolve, reject) => {
    try {
      if (!videoPath) {
        throw new Error("[FaceDetectionWorker] videoPath é obrigatório");
      }

      assertFileExists(videoPath, "Vídeo");

      const pythonScript = path.join(
        __dirname,
        "python",
        "face_detection.py"
      );

      assertFileExists(pythonScript, "face_detection.py");

      const pythonBin = resolvePythonBinary();

      console.log("👤 [FaceDetectionWorker] Iniciando...");
      console.log("🐍 Python:", pythonBin);
      console.log("🎬 Vídeo:", videoPath);

      const p = spawn(pythonBin, [
        pythonScript,
        videoPath,
        String(confidence)
      ]);

      let stdout = "";
      let stderr = "";

      p.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      p.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      p.on("error", (err) => {
        reject(
          new Error(
            `[FaceDetectionWorker] Erro ao iniciar processo Python: ${err.message}`
          )
        );
      });

      p.on("close", (code) => {
        if (code !== 0) {
          return reject(
            new Error(
              `[FaceDetectionWorker] FaceDetection falhou (${code})\n${stderr}`
            )
          );
        }

        try {
          const parsed = JSON.parse(stdout.trim());

          console.log("✅ [FaceDetectionWorker] Finalizado com sucesso");

          return resolve(parsed);
        } catch (e) {
          return reject(
            new Error(
              `[FaceDetectionWorker] JSON inválido retornado pelo Python\nSaída:\n${stdout}`
            )
          );
        }
      });

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = FaceDetectionWorker;
