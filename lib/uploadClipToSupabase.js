const fs = require("fs");
const path = require("path");
const { supabase } = require("./supabaseClient");

module.exports = async function uploadClipToSupabase({
  localFilePath,
  userId,
  jobId,
}) {
  if (!fs.existsSync(localFilePath)) {
    throw new Error(`Arquivo não encontrado: ${localFilePath}`);
  }

  if (!userId) throw new Error("userId é obrigatório");
  if (!jobId) throw new Error("jobId é obrigatório");

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "raw-clips";

  const fileBuffer = fs.readFileSync(localFilePath);

  const storagePath = `${userId}/${jobId}.mp4`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (error) {
    throw new Error(`Erro ao fazer upload: ${error.message}`);
  }

  return {
    bucket,
    path: storagePath,
  };
};
