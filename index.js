// index.js (CommonJS)
require("dotenv").config();
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const path = require("path");
const BASE_TEMP_DIR = path.join(__dirname, "temp");
const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB
});

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

function safeMkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

const { supabaseAdmin } = require("./services/supabaseAdmin");
const validateJobContract = require("./validators/validateJobContract");
const videoDownloader = require("./services/videoDownloader");
const audioExtractor = require("./services/audioExtractor");
const audioTranscriber = require("./services/audioTranscriber");
const { analyzeViralMoments } = require("./services/aiAnalyzer");
const ClipAssembler = require("./workers/ClipAssembler");
const faceDetectionWorker = require("./workers/faceDetectionWorker");
const FaceDominanceAnalyzer = require("./workers/faceDominanceAnalyzer");
const FixedVerticalCropBuilder = require("./workers/FixedVerticalCropBuilder");
const VerticalRenderWorker = require("./workers/verticalRenderWorker");
const CaptionMerge = require("./services/captionMerge");
// CORRETO
const { CaptionEngine } = require("./services/captionEngines");

const uploadToR2 = require("./services/r2Uploader");
const ClipThumbnailWorker = require("./workers/ClipThumbnailWorker");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const rateLimit = require("express-rate-limit");
const { checkCreditsOrThrow } = require("./services/billingService");

const app = express();

// Deve ser a primeira configuração — Railway usa proxy reverso
app.set("trust proxy", 1);

app.use(cors({
  origin: true,
  credentials: true
}));

const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const stripeWebhook = require("./services/stripeWebhook");

// 🔥 REGISTRAR WEBHOOK AQUI (ANTES DO express.json)
stripeWebhook(app, stripe, supabaseAdmin);

// IMPORTANTE: vem DEPOIS do webhook
app.use(express.json());

const generateClipsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Try again later." },
});

const jobStatusLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Try again later." },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Try again later." },
});

// Limiter separado para /upload-url (geração de URL, sem upload real)
const uploadUrlLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Try again later." },
});

app.get("/", (req, res) => res.status(200).send("OK"));
app.get("/health", (req, res) => res.status(200).json({ ok: true }));
      
// ===============================
// BILLING - START (Checkout ou Portal)
// ===============================

const PRICE_MAP = {
  essential: process.env.STRIPE_PRICE_ESSENTIAL,
  growth: process.env.STRIPE_PRICE_GROWTH,
  elite: process.env.STRIPE_PRICE_ELITE,
};

function resolvePriceId(planKey) {
  const priceId = PRICE_MAP[String(planKey || "").toLowerCase()];
  if (!priceId) {
    const err = new Error("INVALID_PLAN");
    err.code = "INVALID_PLAN";
    throw err;
  }
  return priceId;
}

async function getSubscriptionRowByUserId(supabaseAdmin, userId) {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id, stripe_customer_id, stripe_subscription_id, status, plan, stripe_price_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data; // pode ser null
}

async function createPortalSession(stripe, customerId) {
  const returnUrl = process.env.FRONTEND_DASHBOARD_URL;
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

async function createCheckoutSession({ stripe, userId, email, priceId, existingCustomerId }) {
  const successUrl = `${process.env.FRONTEND_DASHBOARD_URL}?billing=success`;
  const cancelUrl = `${process.env.FRONTEND_PARTNERSHIP_URL}?billing=cancel`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],

    // IMPORTANT: link com o seu userId (Supabase Auth UUID)
    client_reference_id: userId,
    metadata: { userId, priceId },

    // também grava metadata dentro da subscription do Stripe
    subscription_data: {
      metadata: { userId, priceId },
    },

    // Se já tiver customerId, melhor ainda
    ...(existingCustomerId ? { customer: existingCustomerId } : {}),
    ...(email ? { customer_email: email } : {}),

    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
  });

  return session.url;
}

/**
 * POST /billing/start
 * body: { userId: string, planKey: "essential"|"growth"|"elite", email?: string }
 *
 * return:
 *  { mode: "portal", url }
 *  OU
 *  { mode: "checkout", url }
 */
app.post("/billing/start", async (req, res) => {
  try {
    const { userId, planKey, email } = req.body || {};

    if (!userId) return res.status(400).json({ error: "Missing userId" });
    if (!planKey) return res.status(400).json({ error: "Missing planKey" });

    const priceId = resolvePriceId(planKey);

    // 1) Verifica assinatura atual no Supabase (espelho do Stripe via webhook)
    const sub = await getSubscriptionRowByUserId(supabaseAdmin, userId);

    // 2) Se já está active, manda pro portal (gerenciar plano/cartão)
    if (sub?.status === "active" && sub?.stripe_customer_id) {
      const url = await createPortalSession(stripe, sub.stripe_customer_id);
      return res.json({ mode: "portal", url });
    }

    // 3) Caso contrário, manda pro checkout no plano escolhido
    const checkoutUrl = await createCheckoutSession({
      stripe,
      userId,
      email,
      priceId,
      existingCustomerId: sub?.stripe_customer_id || null,
    });

    return res.json({ mode: "checkout", url: checkoutUrl });
  } catch (err) {
  console.error("🔥 FULL BILLING ERROR:");
  console.error("Message:", err?.message);
  console.error("Code:", err?.code);
  console.error("Stack:", err?.stack);

  return res.status(500).json({
    error: "Billing start failed",
    message: err?.message,
    code: err?.code,
  });
}
});

/* ======================================================
   📦 UTIL: WRITE JOB STATUS
====================================================== */
function writeJobStatus(jobDir, status, extra = {}) {
  const statusPath = path.join(jobDir, "status.json");

  const data = {
    status,
    progress: extra.progress ?? null, // 🔥 ADICIONADO
    ...extra,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(statusPath, JSON.stringify(data, null, 2));
}

function buildClipsFromAI(aiMoments, clipLength, transcriptSegments, clipCount) {

  const safeLength = Number(clipLength) || 30;
  const maxClipsRequested = Number(clipCount) || 5;

  // 🎯 descobrir duração total do vídeo
  const videoEnd =
    transcriptSegments?.length > 0
      ? Number(
          transcriptSegments[transcriptSegments.length - 1].end ||
          transcriptSegments[transcriptSegments.length - 1].endTime ||
          0
        )
      : 0;

  const clips = [];

  if (!videoEnd || videoEnd <= 0) {
    console.warn("⚠️ videoEnd inválido");
    return clips;
  }

  // 🔥 máximo possível baseado no tamanho do vídeo
  const maxPossibleClips = Math.floor(videoEnd / safeLength);

  const finalClipLimit = Math.min(maxClipsRequested, maxPossibleClips);

  let lastEnd = 0;

  for (let i = 0; i < aiMoments.length; i++) {

    if (clips.length >= finalClipLimit) break;

    const start = Number(aiMoments[i].startTime);

    if (!Number.isFinite(start)) continue;

    // 🚫 evita sobreposição
    if (start < lastEnd) continue;

    let end = start + safeLength;

    // 🔚 não ultrapassar vídeo
    if (end > videoEnd) {
      end = videoEnd;
    }

    // 🚫 evitar clips muito curtos
    if ((end - start) < safeLength * 0.5) continue;

    clips.push({
      clipIndex: clips.length,
      startTime: Number(start.toFixed(2)),
      endTime: Number(end.toFixed(2)),
    });

    lastEnd = end;
  }

  // 🔥 FALLBACK (caso AI falhe ou não consiga gerar suficientes)
  if (clips.length === 0) {

    console.warn("⚠️ AI falhou → fallback sequencial");

    let current = 0;

    while (
      current + safeLength <= videoEnd &&
      clips.length < finalClipLimit
    ) {

      clips.push({
        clipIndex: clips.length,
        startTime: Number(current.toFixed(2)),
        endTime: Number((current + safeLength).toFixed(2)),
      });

      current += safeLength;
    }
  }

  return clips;
}

/* ======================================================
   🚀 PROCESS JOB PIPELINE (BACKGROUND)
====================================================== */
async function processJobPipeline(job, jobDir) {
  const jobId = job.jobId;
const userId = job.userId || job.meta?.userId;
if (!userId) {
  throw new Error("userId ausente no job");
}
  const settings = job.settings;

  try {
    // 🔥 STATUS: processing
writeJobStatus(jobDir, "processing", { progress: 10 });

    // 1️⃣ Download
    const { videoPath } = await videoDownloader(job, BASE_TEMP_DIR);

writeJobStatus(jobDir, "processing", { progress: 20 });

    // 2️⃣ Audio
    const { audioPath } = await audioExtractor({
      videoPath,
      jobId,
      jobDir,
    });

writeJobStatus(jobDir, "processing", { progress: 30 });

    // 3️⃣ Transcrição
    const { transcriptPath } = await audioTranscriber({
      audioPath,
      jobId,
      jobDir,
    });

writeJobStatus(jobDir, "processing", { progress: 40 });

    const transcript = JSON.parse(
      fs.readFileSync(transcriptPath, "utf-8")
    );

    // 🔥 STATUS: generating_clips
writeJobStatus(jobDir, "generating clips", { progress: 50 });

// 4️⃣ Viral Moments (AI - OpenAI)
const aiMoments = await analyzeViralMoments({
  transcript: transcript.segments,
  clipLength: settings.clipLength,
  clipCount: settings.clipCount
});

const viralMoments = buildClipsFromAI(
  aiMoments,
  settings.clipLength,
  transcript.segments,
  settings.clipCount
);

console.log("🎯 FINAL CLIPS:", viralMoments);

writeJobStatus(jobDir, "generating clips", { progress: 60 });

    // 5️⃣ Clip Assembler
    const clipResult = await ClipAssembler({
      videoPath,
      viralMoments,
      jobId,
      jobDir,
    });

writeJobStatus(jobDir, "generating clips", { progress: 70 });

    // 6️⃣ Face Detection
    const faceStats = await faceDetectionWorker({ videoPath });

const dominance = FaceDominanceAnalyzer({
  frames: faceStats.frames || [],
});

const crop = FixedVerticalCropBuilder({
  dominantFace: dominance?.dominantFace || null,
  videoWidth: 1920,
  videoHeight: 1080,
});

    // 7️⃣ Vertical Render
    const verticalResults = [];
    const verticalDir = path.join(jobDir, "vertical");

writeJobStatus(jobDir, "generating clips", { progress: 80 });

    if (!fs.existsSync(verticalDir)) {
      fs.mkdirSync(verticalDir, { recursive: true });
    }

    for (const clip of clipResult.clips) {
      const verticalClipPath = path.join(
        verticalDir,
        `vertical_${clip.clipIndex}.mp4`
      );

      await VerticalRenderWorker({
        inputPath: clip.clipPath,
        outputPath: verticalClipPath,
        crop,
      });

      verticalResults.push({
        clipIndex: clip.clipIndex,
        videoPath: verticalClipPath,
        startTime: clip.startTime,
        endTime: clip.endTime,
      });
    }

console.log("🎬 verticalResults antes do Caption:", JSON.stringify(verticalResults));

    // 8️⃣ Caption Engine
    const captionPayload = CaptionMerge({
      jobId,
      jobDir,
      userId,
      transcript,
      verticalClips: verticalResults,
    });

writeJobStatus(jobDir, "generating clips", { progress: 90 });

    const captionResults = await CaptionEngine(captionPayload);

    if (!Array.isArray(captionResults)) {
      throw new Error("CaptionEngine deve retornar array");
    }

    // 9️⃣ Upload
    const uploadedClips = [];

    for (const clip of captionResults) {
const thumbnailPath = await ClipThumbnailWorker({
  videoPath: clip.videoPath, // ✅ CORRETO
  jobDir,
});

const videoKey = await uploadToR2(
  clip.videoPath,
  userId,
  jobId
);

      const thumbKey = await uploadToR2(
        thumbnailPath,
        userId,
        jobId
      );

      uploadedClips.push({
        clipIndex: clip.clipIndex,
        startTime: clip.startTime,
        endTime: clip.endTime,
        videoKey,
        thumbKey,
      });
    }

writeJobStatus(jobDir, "clips ready", {
  progress: 100,
  clips: uploadedClips
});

  } catch (err) {
    console.error("❌ Pipeline error:", err);

    writeJobStatus(jobDir, "failed", {
      error: err.message,
    });
  }
}

// ===============================
// R2 UPLOAD ENDPOINT (/upload)
// ===============================

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

app.post("/upload", uploadLimiter, upload.single("video"), async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "No file received (field: video)"
      });
    }

    if (!process.env.R2_BUCKET_NAME) {
      return res.status(500).json({
        ok: false,
        error: "Missing env: R2_BUCKET_NAME"
      });
    }

    const file = req.file;

    if (!file.mimetype.startsWith("video/")) {
      return res.status(400).json({
        ok: false,
        error: "Invalid file type. Only video allowed"
      });
    }

    const userId = req.body.userId;
    const jobId = req.body.jobId;

    if (!userId || !jobId) {
      return res.status(400).json({
        ok: false,
        error: "Missing userId or jobId"
      });
    }

    const key = `uploads/${userId}/${jobId}/source.mp4`;

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype ?? "video/mp4",
      })
    );

    console.log("[UPLOAD SUCCESS]", {
      key,
      userId,
      jobId,
      sizeMB: (file.size / 1024 / 1024).toFixed(2),
      type: file.mimetype
    });

    return res.json({ ok: true, key });

  } catch (err) {
    console.error("[UPLOAD ERROR]", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Upload failed"
    });
  }
});

// ===============================
// GENERATE SIGNED UPLOAD URL (R2)
// ===============================
app.post("/upload-url", uploadUrlLimiter, async (req, res) => {

  try {

    const { userId, jobId } = req.body || {};

    // -------------------------
    // Validate payload
    // -------------------------
    if (!userId || !jobId) {
      return res.status(400).json({
        ok: false,
        error: "missing userId or jobId"
      });
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


    if (!uuidRegex.test(jobId)) {
      return res.status(400).json({
        ok: false,
        error: "invalid jobId format"
      });
    }

    // -------------------------
    // Validate env
    // -------------------------
    const bucket = process.env.R2_BUCKET_NAME;

    if (!bucket) {
      console.error("❌ Missing env R2_BUCKET_NAME");

      return res.status(500).json({
        ok: false,
        error: "server configuration error"
      });
    }

    // -------------------------
    // Build object key
    // -------------------------
    const key = `uploads/${userId}/${jobId}/source.mp4`;

    // -------------------------
    // Create signed upload command
    // -------------------------
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: "video/mp4"
    });

    // -------------------------
    // Generate signed URL
    // -------------------------
    const uploadUrl = await getSignedUrl(r2, command, {
      expiresIn: 600 // 10 minutes
    });

    console.log("✅ Signed upload URL generated:", key);

    return res.status(200).json({
      ok: true,
      uploadUrl,
      key
    });

  } catch (err) {

    console.error("❌ upload-url endpoint error:", err);

    return res.status(500).json({
      ok: false,
      error: "failed to generate upload url"
    });

  }

});

/* ======================================================
   📡 POST /generate-clips
   RESPONDE IMEDIATAMENTE
====================================================== */
app.post("/generate-clips", generateClipsLimiter, async (req, res) => {
  try {
    const job = req.body;

    validateJobContract(job);

    const jobId = job.jobId;
    const userId = job.userId;
    const jobDir = path.join(BASE_TEMP_DIR, jobId);

    // Verificar créditos antes de iniciar o pipeline (sem descontar — o frontend já descontou)
    await checkCreditsOrThrow(supabaseAdmin, userId, job.settings.clipCount);

    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }

    // STATUS INICIAL (userId guardado para verificação posterior)
    writeJobStatus(jobDir, "queued", { userId });

    // 🔥 RESPONDE IMEDIATAMENTE
    res.json({
      success: true,
      jobId,
      status: "queued",
    });

    // 🚀 RODA EM BACKGROUND
    processJobPipeline(job, jobDir);

  } catch (err) {
    console.error("❌ Erro no endpoint:", err);

    const billingCodes = [
      "insufficient_credits",
      "no_active_subscription",
      "billing_error",
      "not_allowed",
    ];
    if (billingCodes.includes(err.code) || billingCodes.includes(err.message)) {
      return res.status(402).json({
        success: false,
        error: "billing_error",
        code: err.code || err.message,
        remaining: err.remaining ?? null,
      });
    }

    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});


/* ======================================================
   📡 GET /jobs/:jobId
====================================================== */
app.get("/jobs/:jobId", jobStatusLimiter, (req, res) => {
  console.log("[GET /jobs/:jobId] params:", req.params, "query:", req.query, "x-user-id header:", req.headers["x-user-id"] || "(ausente)");
  try {
    const { jobId } = req.params;
    const userId = req.query.userId || req.headers["x-user-id"];

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId é obrigatório via query param (?userId=...) ou header X-User-Id",
      });
    }

    const jobDir = path.join(BASE_TEMP_DIR, jobId);
    const statusPath = path.join(jobDir, "status.json");

    if (!fs.existsSync(statusPath)) {
      return res.status(404).json({
        success: false,
        error: "Job não encontrado",
      });
    }

    const raw = fs.readFileSync(statusPath, "utf-8");
    const statusData = JSON.parse(raw);

    if (statusData.userId && statusData.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: "Acesso negado",
      });
    }

    return res.json({
      success: true,
      jobId,
      ...statusData,
    });

  } catch (err) {
    console.error("❌ Erro ao buscar status:", err);

    return res.status(500).json({
      success: false,
      error: "Erro interno",
    });
  }
});

app.get('/debug/video/:jobId', (req, res) => {
  const fs = require('fs');
  const path = require('path');

  const { jobId } = req.params;

  const videoPath = `/app/temp/${jobId}/source.mp4`;

  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('Video not found');
  }

  res.sendFile(videoPath);
});

const PORT = process.env.PORT || 3000;

/* ======================================================
   🚀 START SERVER
====================================================== */
app.listen(PORT, () => {
  console.log("🚀 ViralClip API running on port", PORT);
});
