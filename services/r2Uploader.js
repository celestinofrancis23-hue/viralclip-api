const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function uploadToR2(file, userId, jobId) {

  if (!file || !file.buffer) {
    throw new Error("Invalid file buffer");
  }

  const extension = file.originalname.split(".").pop().toLowerCase();

  const key = `clips/${userId}/${jobId}.${extension}`;

  console.log("UPLOAD DEBUG:", {
    userId,
    jobId,
    fileName: file.originalname
  });

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  });

  await r2.send(command);

  return key;
}

module.exports = uploadToR2;
