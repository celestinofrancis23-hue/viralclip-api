require("dotenv").config();
const uploadClipToSupabase = require("../lib/uploadClipToSupabase");

(async () => {
  try {
    const result = await uploadClipToSupabase({
      localFilePath: "./temp/test.mp4", // qualquer mp4 pequeno
      userId: "test-user-001",
      jobId: "job-test-001",
    });

    console.log("✅ Upload feito:", result);
  } catch (err) {
    console.error("❌ Erro:", err.message);
  }
})();
