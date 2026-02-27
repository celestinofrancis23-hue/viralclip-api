// sources/downloadYouTube.js (CommonJS)

const path = require("path");
const fs = require("fs");
const os = require("os");
const ytdlp = require("yt-dlp-exec");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function downloadYouTube(resolvedSource, jobId) {
  if (!resolvedSource?.originalUrl) {
    throw new Error("resolvedSource.originalUrl ausente");
  }

  // 👉 usar pasta downloads do projeto
  const baseDir = path.join(process.cwd(), "downloads", jobId);
  ensureDir(baseDir);

  const outputPath = path.join(baseDir, "source.mp4");

  console.log("⬇️ yt-dlp iniciando:", resolvedSource.originalUrl);
  console.log("📁 Salvando em:", outputPath);

await ytdlp(resolvedSource.originalUrl, {
  output: outputPath,
  format: "bv*[ext=mp4]+ba[ext=m4a]/mp4",
  mergeOutputFormat: "mp4",
  noPlaylist: true,
  preferFreeFormats: true,
  concurrentFragments: 5,
  retries: 3,
  quiet: true,

  // 🔐 COOKIES DIRETO DO CHROME (ESSENCIAL)
  cookiesFromBrowser: "chrome",
});
  return {
    localVideoPath: outputPath,
    size: fs.statSync(outputPath).size,
  };
}

// 🔥 ISSO É O MAIS IMPORTANTE
module.exports = downloadYouTube;

