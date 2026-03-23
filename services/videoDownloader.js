const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const COOKIES_PATH = "/app/cookies.txt";

const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

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
      `[VideoDownloader] Arquivo muito pequeno (${size} bytes).`
    );
  }

  return size;
}

function runYtDlp(url, outputPath, format) {
  return new Promise((resolve, reject) => {

    const args = [
      "--cookies", COOKIES_PATH,
      url,
      "--output", outputPath,
      "--format", format,
      "--merge-output-format", "mkv",
      "--no-warnings",
      "--retries", "15",
      "--fragment-retries", "15",
      "--extractor-args", "youtube:player_client=android",
      "--add-header", "User-Agent: Mozilla/5.0",
      "--add-header", "Accept-Language: en-US,en;q=0.9"
    ];

    console.log("🚀 yt-dlp:", args.join(" "));

    const proc = spawn("yt-dlp", args);

    proc.stdout.on("data", (d) => console.log(`[yt-dlp] ${d}`));
    proc.stderr.on("data", (d) => console.error(`[yt-dlp error] ${d}`));

    proc.on("error", reject);

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp exited with ${code}`));
    });
  });
}

// 🔥 DOWNLOAD DO R2 (UPLOAD FLOW)
async function downloadFromR2(key, outputPath) {

  if (!R2_PUBLIC_BASE_URL) {
    throw new Error("R2_PUBLIC_BASE_URL não definido no .env");
  }

  const url = `${R2_PUBLIC_BASE_URL}/${key}`;

  console.log("⬇️ [R2] Download:", url);

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`[R2] Falha download: ${res.status}`);
  }

  const fileStream = fs.createWriteStream(outputPath);

  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on("error", reject);
    fileStream.on("finish", resolve);
  });

  console.log("✅ [R2] Download concluído:", outputPath);
}

// ===============================
// MAIN EXPORT
// ===============================
module.exports = async function videoDownloader(job, baseTempDir) {

  const { jobId, source } = job;

  if (!jobId) {
    throw new Error("[VideoDownloader] jobId obrigatório");
  }

  if (!source || !source.type) {
    throw new Error("[VideoDownloader] source.type obrigatório");
  }

  const jobDir = path.join(baseTempDir, String(jobId));
  safeMkdir(jobDir);

  const finalPath = path.join(jobDir, "source.mp4");

  // ====================================
  // 🔥 CASE 1 — YOUTUBE
  // ====================================
  if (source.type === "youtube") {

    if (!source.url) {
      throw new Error("[VideoDownloader] source.url obrigatório");
    }

    console.log("⬇️ YouTube download:", source.url);

    const outputPath = path.join(jobDir, "source.%(ext)s");

    const primaryFormat = "bestvideo+bestaudio/best";
    const fallbackFormat = "best";

    try {
      await runYtDlp(source.url, outputPath, primaryFormat);
    } catch (err) {
      console.warn("⚠️ fallback yt-dlp...");
      await runYtDlp(source.url, outputPath, fallbackFormat);
    }

    const files = listDir(jobDir);

    const videoFile = files.find((f) =>
      f.match(/\.(mkv|mp4|webm)$/i)
    );

    if (!videoFile) {
      throw new Error("[VideoDownloader] Nenhum vídeo gerado");
    }

    const size = ensureFileLooksValid(videoFile);

    console.log("✅ YouTube download OK:", videoFile);

    return {
      videoPath: videoFile,
      jobDir,
    };
  }

  // ====================================
  // 🔥 CASE 2 — UPLOAD (R2)
  // ====================================
  if (source.type === "upload") {

    if (!source.key) {
      throw new Error("[VideoDownloader] source.key obrigatório");
    }

    await downloadFromR2(source.key, finalPath);

    const size = ensureFileLooksValid(finalPath);

    console.log("✅ Upload video ready:", finalPath);
    console.log("📏 Size:", (size / 1024 / 1024).toFixed(2), "MB");

    return {
      videoPath: finalPath,
      jobDir,
    };
  }

  throw new Error(`[VideoDownloader] source.type inválido: ${source.type}`);
};
