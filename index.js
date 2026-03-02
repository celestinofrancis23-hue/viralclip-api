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

function safeMkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

const { supabaseAdmin } = require("./services/supabaseAdmin");
const validateJobContract = require("./validators/validateJobContract");
const videoDownloader = require("./services/videoDownloader");
const audioExtractor = require("./services/audioExtractor");
const audioTranscriber = require("./services/audioTranscriber");
const ViralMomentAnalyzer = require("./workers/viralMomentAnalyzer");
const ClipAssembler = require("./workers/ClipAssembler");
const faceDetectionWorker = require("./workers/faceDetectionWorker");
const FaceDominanceAnalyzer = require("./workers/faceDominanceAnalyzer");
const FixedVerticalCropBuilder = require("./workers/FixedVerticalCropBuilder");
const VerticalRenderWorker = require("./workers/verticalRenderWorker");
const CaptionMerge = require("./services/captionMerge");
const CaptionEngine = require("./services/captionEngine");
const uploadToR2 = require("./services/r2Uploader");
const ClipThumbnailWorker = require("./workers/ClipThumbnailWorker");

const app = express();
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
    ...extra,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(statusPath, JSON.stringify(data, null, 2));
}

/* ======================================================
   🚀 PROCESS JOB PIPELINE (BACKGROUND)
====================================================== */
async function processJobPipeline(job, jobDir) {
  const jobId = job.jobId;
  const userId = job.meta?.userId;
  const settings = job.settings;

  try {
    // 🔥 STATUS: processing
    writeJobStatus(jobDir, "processing");

    // 1️⃣ Download
    const { videoPath } = await videoDownloader(job, BASE_TEMP_DIR);

    // 2️⃣ Audio
    const { audioPath } = await audioExtractor({
      videoPath,
      jobId,
      jobDir,
    });

    // 3️⃣ Transcrição
    const { transcriptPath } = await audioTranscriber({
      audioPath,
      jobId,
      jobDir,
    });

    const transcript = JSON.parse(
      fs.readFileSync(transcriptPath, "utf-8")
    );

    // 🔥 STATUS: generating_clips
    writeJobStatus(jobDir, "generating clips");

    // 4️⃣ Viral Moments
    const viralMoments = await ViralMomentAnalyzer({
      transcriptSegments: transcript.segments,
      clipLengthSeconds: settings.clipLength,
      clipCount: settings.clipCount,
    });

    // 5️⃣ Clip Assembler
    const clipResult = await ClipAssembler({
      videoPath,
      viralMoments,
      jobId,
      jobDir,
    });

    // 6️⃣ Face Detection
    const faceStats = await faceDetectionWorker({ videoPath });

    const dominance = FaceDominanceAnalyzer({
      frames: faceStats.frames,
    });

    const crop = FixedVerticalCropBuilder({
      dominantFace: dominance.dominantFace,
      videoWidth: 1920,
      videoHeight: 1080,
    });

    // 7️⃣ Vertical Render
    const verticalResults = [];
    const verticalDir = path.join(jobDir, "vertical");

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

    // 8️⃣ Caption Engine
    const captionPayload = CaptionMerge({
      jobId,
      jobDir,
      transcript,
      verticalClips: verticalResults,
    });

    const captionResults = await CaptionEngine(captionPayload);

    if (!Array.isArray(captionResults)) {
      throw new Error("CaptionEngine deve retornar array");
    }

    // 9️⃣ Upload
    const uploadedClips = [];

    for (const clip of captionResults) {
      const thumbnailPath = await ClipThumbnailWorker({
        videoPath: clip.outputVideoPath,
        jobDir,
      });

      const videoKey = await uploadToR2(
        clip.outputVideoPath,
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

    // 🔥 STATUS: clips_ready
    writeJobStatus(jobDir, "clips ready", {
      clips: uploadedClips,
    });

  } catch (err) {
    console.error("❌ Pipeline error:", err);

    writeJobStatus(jobDir, "failed", {
      error: err.message,
    });
  }
}

// ===============================
// R2 CLIENT CONFIG
// ===============================
const r2 = new S3Client({
  region: process.env.R2_REGION || "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});


// ===============================
// CONTENT TYPE DETECTOR
// ===============================
function detectContentType(fileName) {
  const extension = path.extname(fileName).toLowerCase();

  const map = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };

  return map[extension] || "application/octet-stream";
}

app.post("/upload-direct", upload.single("video"), async (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).json({ error: "No file received" });
    }

    const key = await uploadBufferToR2(
      req.file.buffer,
      req.file.originalname,
      "public"
    );

    return res.json({
      success: true,
      key
    });

  } catch (err) {

    console.error("UPLOAD ERROR:", err);

    return res.status(500).json({
      error: "R2 upload failed"
    });
  }
});

/* ======================================================
   📡 POST /generate-clips
   RESPONDE IMEDIATAMENTE
====================================================== */
app.post("/generate-clips", async (req, res) => {
  try {
    const job = req.body;

    validateJobContract(job);

    const jobId = job.jobId;
    const jobDir = path.join(BASE_TEMP_DIR, jobId);

    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }

    // STATUS INICIAL
    writeJobStatus(jobDir, "queued");

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

    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});


/* ======================================================
   📡 GET /jobs/:jobId
====================================================== */
app.get("/jobs/:jobId", (req, res) => {
  try {
    const { jobId } = req.params;
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
