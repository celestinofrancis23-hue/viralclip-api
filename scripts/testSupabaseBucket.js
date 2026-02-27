require('dotenv').config();
const { supabase } = require('../lib/supabaseClient');

async function testBucket() {
  console.log('🔍 Testando conexão com Supabase Storage...');

  const { data, error } = await supabase.storage.listBuckets();

  if (error) {
    console.error('❌ Erro ao listar buckets:', error.message);
    process.exit(1);
  }

  console.log('✅ Buckets encontrados:');
  data.forEach((bucket) => {
    console.log('-', bucket.name);
  });

  const bucketName = process.env.SUPABASE_STORAGE_BUCKET;

  const exists = data.some((b) => b.name === bucketName);

  if (!exists) {
    console.error(`❌ Bucket "${bucketName}" NÃO existe`);
    process.exit(1);
  }

  console.log(`✅ Bucket "${bucketName}" existe e está acessível`);
}

testBucket();
