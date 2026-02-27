const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[FaceDetectionWorker] ${label} não encontrado: ${filePath}`);
  }
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

      // 🔥 FORÇA uso da VENV
      const pythonBin = path.join(
        process.cwd(),
        ".venv",
        "bin",
        "python"
      );

      assertFileExists(pythonBin, "Python da venv");

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
