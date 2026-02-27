require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { r2 } = require("../lib/r2Client");

(async () => {
  try {
    const filePath = path.join(__dirname, "r2-test.txt");
    fs.writeFileSync(filePath, "R2 test OK");

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: "system/test/r2-test.txt",
      Body: fs.createReadStream(filePath),
      ContentType: "text/plain",
    });

    await r2.send(command);

    console.log("✅ Upload de teste para Cloudflare R2 concluído com sucesso");
  } catch (err) {
    console.error("❌ Erro no upload para R2:", err);
  }
})();
