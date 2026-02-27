// index.js (CommonJS)

const express = require("express");
const cors = require("cors");

const captionWorker = require("./workers/captionWorker");


const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ===============================
// ETAPA 2 — Endpoint principal
// Recebe o Job Contract do n8n
// ===============================
app.post("/generate-clips", async (req, res) => {
  try {
    const job = req.body;

    console.log("📥 Job recebido:", JSON.stringify(job, null, 2));

await captionWorker(job);


    return res.json({
      ok: true,
      message: "Job recebido com sucesso",
      jobId: job.jobId,
      sourceType: job.source?.type,
      templateSlug: job.template?.slug,
    });

  } catch (err) {
    console.error("❌ Erro no /generate-clips:", err);
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log("🚀 ViralClip API running on port", PORT);
});

