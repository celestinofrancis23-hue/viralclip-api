const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function uploadToR2(filePath, userId, jobId) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("Arquivo não encontrado: " + filePath);
  }

  const buffer = fs.readFileSync(filePath);

  if (!buffer || buffer.length === 0) {
    throw new Error("Invalid file buffer (empty)");
  }

  const fileName = path.basename(filePath);
  const extension = fileName.split(".").pop().toLowerCase();

  const key = `clips/${userId}/${jobId}/${fileName}`;

  console.log("📤 UPLOAD DEBUG:", {
    filePath,
    size: buffer.length,
    key,
  });

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: "video/mp4",
  });

  await r2.send(command);

  return key;
}

module.exports = uploadToR2;
