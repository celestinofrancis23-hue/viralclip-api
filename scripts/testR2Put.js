require("dotenv").config();

const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// ================================
// CONFIG R2
// ================================
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// ================================
// ARQUIVO REAL DO BURN WORKER
// ================================
const userId = "47f58818-9a07-474d-9ad4-75d36f50b2b5";
const jobId = "490418d1-1d4f-4b60-a6ca-d8ce73e5d5b3";

const filePath =
  "/Users/celestinofrancisco/Desktop/viralclip-api/temp/490418d1-1d4f-4b60-a6ca-d8ce73e5d5b3/clip_1_burned.mp4";

// ================================
// TESTE UPLOAD
// ================================
async function upload() {
  console.log("🔍 Verificando ENV...");
  console.log("R2_ACCESS_KEY_ID:", process.env.R2_ACCESS_KEY_ID);
  console.log("R2_SECRET_ACCESS_KEY:", process.env.R2_SECRET_ACCESS_KEY ? "OK" : "UNDEFINED");
  console.log("R2_BUCKET_NAME:", process.env.R2_BUCKET_NAME);
  console.log("R2_ENDPOINT:", process.env.R2_ENDPOINT);

  if (!fs.existsSync(filePath)) {
    throw new Error("❌ Arquivo não encontrado: " + filePath);
  }

  const key = `clips/${userId}/${jobId}/clip_1_burned.mp4`;

  console.log("🚀 Uploading para R2:", key);

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: fs.createReadStream(filePath),
    ContentType: "video/mp4",
  });

  await r2.send(command);

  console.log("✅ Upload concluído com sucesso!");
  console.log("📦 R2 path:", key);
}

upload().catch((err) => {
  console.error("❌ Erro no upload:", err);
});
