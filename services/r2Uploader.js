const fs = require("fs");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function uploadToR2(localFilePath, userId, jobId) {
  if (!fs.existsSync(localFilePath)) {
    throw new Error("Arquivo não encontrado: " + localFilePath);
  }

  const fileName = path.basename(localFilePath);
  const extension = path.extname(fileName).toLowerCase();

  console.log("UPLOAD DEBUG:", { userId, jobId, fileName });

  const key = `clips/${userId}/${jobId}/${fileName}`;

  // 🔥 Detectar ContentType corretamente
  let contentType = "application/octet-stream";

  if (extension === ".mp4") {
    contentType = "video/mp4";
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    contentType = "image/jpeg";
  }

  if (extension === ".png") {
    contentType = "image/png";
  }

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: fs.createReadStream(localFilePath),
    ContentType: contentType,
  });

  await r2.send(command);

  return key;
}

module.exports = uploadToR2;
