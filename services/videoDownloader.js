const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const COOKIES_LOCAL_PATH  = "/tmp/yt_cookies.txt";
const COOKIES_R2_KEY      = "config/youtube-cookies.txt";
const COOKIES_MAX_AGE_MS  = 24 * 60 * 60 * 1000; // 24 horas

const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

// Cliente R2 próprio do videoDownloader (o de index.js não está acessível aqui)
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// ── Cookies ────────────────────────────────────────────────────────────────────
// Descarrega config/youtube-cookies.txt do R2 para /tmp/yt_cookies.txt.
// Usa cache de 24 horas — só vai ao R2 se o ficheiro local não existir
// ou tiver mais de 24 horas.
async function resolveCookiesPath() {
  // Verificar cache local
  if (fs.existsSync(COOKIES_LOCAL_PATH)) {
    const age = Date.now() - fs.statSync(COOKIES_LOCAL_PATH).mtimeMs;
    if (age < COOKIES_MAX_AGE_MS) {
      console.log(`🍪 [cookies] Cache válido (${Math.round(age / 60000)} min) → ${COOKIES_LOCAL_PATH}`);
      return COOKIES_LOCAL_PATH;
    }
    console.log("🍪 [cookies] Cache expirado — a actualizar do R2...");
  } else {
    console.log("🍪 [cookies] Ficheiro local ausente — a descarregar do R2...");
  }

  // Descarregar do R2
  try {
    const cmd = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key:    COOKIES_R2_KEY,
    });

    const { Body } = await r2.send(cmd);

    // Body é um ReadableStream (Node.js) — colectar chunks
    const chunks = [];
    for await (const chunk of Body) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks).toString("utf8");

    if (!content.trim()) {
      throw new Error("Ficheiro de cookies vazio no R2");
    }

    fs.writeFileSync(COOKIES_LOCAL_PATH, content, "utf8");
    console.log(`✅ [cookies] Descarregado de R2 (${COOKIES_R2_KEY}) → ${COOKIES_LOCAL_PATH}`);
    return COOKIES_LOCAL_PATH;

  } catch (err) {
    console.warn("⚠️  [cookies] Falha ao descarregar do R2:", err.message);

    // Fallback: usar cache expirado se existir (melhor do que nada)
    if (fs.existsSync(COOKIES_LOCAL_PATH)) {
      console.warn("⚠️  [cookies] A usar cache expirado como fallback");
      return COOKIES_LOCAL_PATH;
    }

    console.warn("⚠️  [cookies] Sem cookies — a tentar sem autenticação");
    return null;
  }
}

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

// ── runYtDlp ──────────────────────────────────────────────────────────────────
// Tenta um único download com o player_client e formato fornecidos.
function runYtDlp(url, outputPath, format, playerClient, cookiesPath) {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      "--output", outputPath,
      "--format", format,
      "--merge-output-format", "mkv",
      "--no-warnings",
      "--retries", "5",
      "--fragment-retries", "5",
      "--extractor-args", `youtube:player_client=${playerClient}`,
      "--add-header", "User-Agent: Mozilla/5.0",
      "--add-header", "Accept-Language: en-US,en;q=0.9",
    ];

    if (cookiesPath) {
      args.unshift("--cookies", cookiesPath);
    }

    console.log(`🚀 yt-dlp [client=${playerClient}, format=${format}]:`, args.join(" "));

    const proc = spawn("yt-dlp", args);

    const stderrLines = [];
    proc.stdout.on("data", (d) => console.log(`[yt-dlp] ${d}`));
    proc.stderr.on("data", (d) => {
      const line = d.toString();
      stderrLines.push(line.trim());
      console.error(`[yt-dlp error] ${line}`);
    });

    proc.on("error", reject);

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const summary = stderrLines.slice(-5).join(" | ");
        reject(new Error(`yt-dlp [${playerClient}] exited ${code}: ${summary}`));
      }
    });
  });
}

// ── downloadYouTube ───────────────────────────────────────────────────────────
// Tenta múltiplos player_clients em sequência.
// Para cada client, tenta primeiro o formato completo, depois o formato simples.
async function downloadYouTube(url, outputPath, cookiesPath) {
  const clients = ["android", "web", "ios"];
  const formats = ["bestvideo+bestaudio/best", "best"];

  const errors = [];

  for (const client of clients) {
    for (const format of formats) {
      try {
        await runYtDlp(url, outputPath, format, client, cookiesPath);
        console.log(`✅ yt-dlp sucesso [client=${client}, format=${format}]`);
        return; // sucesso — sair imediatamente
      } catch (err) {
        console.warn(`⚠️  yt-dlp falhou [client=${client}, format=${format}]:`, err.message);
        errors.push(`[${client}/${format}] ${err.message}`);

        // Se o erro for "Sign in" / bot check, não faz sentido tentar o outro
        // formato com o mesmo client — mas ainda vale tentar outro client
        if (/Sign in|bot|confirm/i.test(err.message)) {
          break; // saltar para o próximo client
        }
      }
    }
  }

  // Todos os clientes falharam
  throw new Error(
    `[VideoDownloader] Todos os clientes yt-dlp falharam:\n${errors.join("\n")}`
  );
}

// ── downloadFromR2 ────────────────────────────────────────────────────────────
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

  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));

  console.log("✅ [R2] Download concluído:", outputPath);
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
module.exports = async function videoDownloader(job, baseTempDir) {
  const { jobId, source } = job;

  if (!jobId) throw new Error("[VideoDownloader] jobId obrigatório");
  if (!source || !source.type) throw new Error("[VideoDownloader] source.type obrigatório");

  const jobDir    = path.join(baseTempDir, String(jobId));
  safeMkdir(jobDir);

  const finalPath = path.join(jobDir, "source.mp4");

  // ── CASE 1 — YOUTUBE ───────────────────────────────────────────────────────
  if (source.type === "youtube") {
    if (!source.url) throw new Error("[VideoDownloader] source.url obrigatório");

    console.log("⬇️ YouTube download:", source.url);

    const cookiesPath = await resolveCookiesPath();
    const outputPath  = path.join(jobDir, "source.%(ext)s");

    await downloadYouTube(source.url, outputPath, cookiesPath);

    const files     = listDir(jobDir);
    const videoFile = files.find((f) => /\.(mkv|mp4|webm)$/i.test(f));

    if (!videoFile) throw new Error("[VideoDownloader] Nenhum vídeo gerado");

    ensureFileLooksValid(videoFile);
    console.log("✅ YouTube download OK:", videoFile);

    return { videoPath: videoFile, jobDir };
  }

  // ── CASE 2 — UPLOAD (R2) ───────────────────────────────────────────────────
  if (source.type === "upload") {
    if (!source.key) throw new Error("[VideoDownloader] source.key obrigatório");

    await downloadFromR2(source.key, finalPath);

    const size = ensureFileLooksValid(finalPath);
    console.log("✅ Upload video ready:", finalPath);
    console.log("📏 Size:", (size / 1024 / 1024).toFixed(2), "MB");

    return { videoPath: finalPath, jobDir };
  }

  throw new Error(`[VideoDownloader] source.type inválido: ${source.type}`);
};
