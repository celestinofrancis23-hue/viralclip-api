const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function safeMkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function listDir(dir) {
  try {
    return fs.readdirSync(dir).map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

function ensureFileLooksValid(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error("[VideoDownloader] Arquivo não encontrado.");
  }

  const size = fs.statSync(filePath).size;

  if (size < 1_000_000) {
    throw new Error(
      `[VideoDownloader] Arquivo muito pequeno (${size} bytes). Possível falha de download.`
    );
  }

  return size;
}

module.exports = async function videoDownloader(job, baseTempDir) {
  const { jobId, source } = job;

  if (!jobId) {
    throw new Error("[VideoDownloader] jobId é obrigatório");
  }

  if (!source || !source.url) {
    throw new Error("[VideoDownloader] source.url é obrigatório");
  }

  console.log("⬇️ [VideoDownloader] Iniciando download máximo real:", source.url);

  const jobDir = path.join(baseTempDir, String(jobId));
  safeMkdir(jobDir);

  const outputPath = path.join(jobDir, "source.%(ext)s");

  try {
    await new Promise((resolve, reject) => {
      const args = [
        source.url,

        "--output", outputPath,

        // 🔥 MELHOR QUALIDADE DISPONÍVEL
        "--format", "bestvideo+bestaudio/best",

        "--merge-output-format", "mkv",

        "--no-warnings",

        "--retries", "15",
        "--fragment-retries", "15",

        "--extractor-args", "youtube:player_client=web",

        "--add-header", "User-Agent: Mozilla/5.0",
        "--add-header", "Accept-Language: en-US,en;q=0.9"
      ];

      console.log("🚀 Executando yt-dlp com args:", args.join(" "));

      const proc = spawn("yt-dlp", args);

      proc.stdout.on("data", (data) => {
        console.log(`[yt-dlp] ${data}`);
      });

      proc.stderr.on("data", (data) => {
        console.error(`[yt-dlp error] ${data}`);
      });

      proc.on("error", (err) => {
        reject(err);
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`));
        }
      });
    });

  } catch (err) {
    const files = listDir(jobDir);
    console.error("❌ yt-dlp falhou. Arquivos encontrados:", files);

    throw new Error(
      `[VideoDownloader] Falha no download: ${err?.message || err}`
    );
  }

  const files = listDir(jobDir);

  const videoFile = files.find((f) =>
    f.match(/\.(mkv|mp4|webm)$/i)
  );

  if (!videoFile) {
    throw new Error(
      `[VideoDownloader] Nenhum vídeo gerado.\nArquivos:\n- ${files.join("\n- ")}`
    );
  }

  const size = ensureFileLooksValid(videoFile);

  console.log("✅ [VideoDownloader] Download concluído com sucesso.");
  console.log("📦 Arquivo:", videoFile);
  console.log("📏 Tamanho:", (size / 1024 / 1024).toFixed(2), "MB");

  return {
    videoPath: videoFile,
    jobDir,
  };
};
