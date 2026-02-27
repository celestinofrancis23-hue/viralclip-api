require("dotenv").config();

const { ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { r2 } = require("../lib/r2Client");

async function testR2() {
  const result = await r2.send(
    new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
    })
  );

  console.log("Conectado ao Cloudflare R2 ✅");
  console.log("Objetos no bucket:", result.Contents || []);
}

testR2().catch((err) => {
  console.error("Erro ao conectar no R2 ❌");
  console.error(err);
});
