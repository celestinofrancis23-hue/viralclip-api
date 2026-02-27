const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// 🔴 MUDA APENAS ISTO
const audioPath = "/Users/celestinofrancisco/Desktop/viralclip-api/temp/d161c8be-80da-4380-ac6a-276789adde39/audio.wav";
const outputDir = path.resolve(__dirname, "whisper_test_output");

if (!fs.existsSync(audioPath)) {
  console.error("❌ Áudio não encontrado:", audioPath);
  process.exit(1);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const whisperCmd = "whisper";

// ⚠️ FLAGS 100% LIMPA (SEM LANGUAGE)
const args = [
  audioPath,

  "--model",
  "small",

  "--task",
  "transcribe",

  "--output_format",
  "json",

  "--word_timestamps",
  "False",

  "--output_dir",
  outputDir,

  "--verbose",
  "True",
];

console.log("\n🧪 COMANDO FINAL:");
console.log(whisperCmd, args.join(" "));
console.log("\n⏳ Iniciando Whisper...\n");

const p = spawn(whisperCmd, args);

p.stdout.on("data", (d) => {
  process.stdout.write(d.toString());
});

p.stderr.on("data", (d) => {
  process.stderr.write(d.toString());
});

p.on("close", (code) => {
  console.log("\n🧪 Whisper finalizado com código:", code);

  if (code !== 0) {
    console.error("❌ Whisper falhou");
    return;
  }

  const base = path.basename(audioPath, path.extname(audioPath));
  const jsonPath = path.join(outputDir, `${base}.json`);

  if (!fs.existsSync(jsonPath)) {
    console.error("❌ JSON não encontrado:", jsonPath);
    return;
  }

  const transcript = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  console.log("\n📝 PRIMEIROS SEGMENTOS:\n");
  transcript.segments.slice(0, 5).forEach((s) => {
    console.log(`[${s.start.toFixed(2)} → ${s.end.toFixed(2)}] ${s.text}`);
  });

  console.log("\n✅ TESTE ISOLADO CONCLUÍDO COM SUCESSO");
});
