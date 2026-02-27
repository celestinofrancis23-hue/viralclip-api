require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
  S3Client,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// ======= AJUSTE AQUI CONFORME NECESSÁRIO =======

// exemplo real baseado no seu print
const localFilePath =
  '/Users/celestinofrancisco/Desktop/viralclip-api/temp/b1ac1e0b-07ed-4598-838b-1c2448a3bfbd/clip_1_burned.mp4';

const userId = 'user_test'; // depois vem do banco
const jobId = 'b1ac1e0b-07ed-4598-838b-1c2448a3bfbd';

const bucketName = 'wow-clips';
const objectKey = `${userId}/${jobId}.mp4`;

// =============================================

async function uploadClip() {
  console.log('📤 Iniciando upload para Cloudflare R2...');
  console.log('Arquivo local:', localFilePath);
  console.log('Destino:', objectKey);

  const fileStream = fs.createReadStream(localFilePath);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    Body: fileStream,
    ContentType: 'video/mp4',
  });

  await r2.send(command);

  console.log('✅ Upload concluído com sucesso!');
}

uploadClip().catch((err) => {
  console.error('❌ Erro no upload:', err);
});
