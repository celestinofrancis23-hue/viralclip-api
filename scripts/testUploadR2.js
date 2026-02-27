const fs = require("fs");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// ==========================
// CONFIG R2
// ==========================
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

// ==========================
// TEST DATA (EDITA AQUI SE QUISER)
// ==========================
const userId = "47f58818-9a07-474d-9ad4-75d36f50b2b5";
const jobId = "009a0738-2534-40d1-937f-4189602ad7bf";

// caminho REAL do mp4 já gerado
const localFilePath =
  "/Users/celestinofrancisco/Desktop/viralclip-api/temp/5b5ecec1-1a06-41e9-b90d-b1c71fe4cf82/clip_1_burned.mp4";

// ==========================
// UPLOAD TEST
// ==========================
async function uploadTest() {
  if (!fs.existsSync(localFilePath)) {
    throw new Error("❌ Arquivo não encontrado: " + localFilePath);
  }

  const key = `clips/${userId}/${jobId}/test.mp4`;

  console.log("⬆️ Uploading to R2:", key);

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: fs.createReadStream(localFilePath),
    ContentType: "video/mp4"
  });

  await r2.send(command);

  console.log("✅ Upload concluído com sucesso!");
  console.log("📂 R2 path:", key);
}

uploadTest().catch(err => {
  console.error("❌ Erro no upload R2:", err);
});
