const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[FaceDetectionWorker] ${label} não encontrado: ${filePath}`);
  }
}

function resolvePythonBinary() {
  const venvPath = path.join(process.cwd(), ".venv", "bin", "python");

  if (fs.existsSync(venvPath)) {
    console.log("🐍 Usando Python da venv:", venvPath);
    return venvPath;
  }

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

      // 📥 capturar saída
      p.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      p.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      // ❌ erro ao iniciar processo
      p.on("error", (err) => {
        return reject(
          new Error(
            `[FaceDetectionWorker] Erro ao iniciar processo Python: ${err.message}`
          )
        );
      });

      // ✅ quando termina
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

          // 🔒 validação
          if (!parsed || !Array.isArray(parsed.frames)) {
            throw new Error("[FaceDetectionWorker] frames inválidos");
          }

          console.log("🎯 Frames detectados:", parsed.frames.length);

          // ⚠️ fallback (sem rosto)
          if (parsed.frames.length === 0) {
            console.log("⚠️ Nenhum rosto detectado → fallback ativado");

            return resolve({
              frames: [],
              fallback: true
            });
          }

          console.log("✅ [FaceDetectionWorker] Finalizado com sucesso");

          return resolve(parsed);

        } catch (err) {
          return reject(
            new Error(
              `[FaceDetectionWorker] JSON inválido retornado pelo Python\nSaída:\n${stdout}`
            )
          );
        }
      });

    } catch (err) {
      return reject(err);
    }
  });
}

module.exports = FaceDetectionWorker;
