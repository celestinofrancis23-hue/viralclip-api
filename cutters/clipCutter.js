const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

/**
 * ClipCutter
 * Executa o plano de corte gerado pelo ClipPlanBuilder
 */
async function ClipCutter({ planPath }) {
  // =========================
  // Validação do plano
  // =========================
  if (!planPath || !fs.existsSync(planPath)) {
    throw new Error("[ClipCutter] Plano de corte não encontrado");
  }

  const plan = JSON.parse(fs.readFileSync(planPath, "utf-8"));

  if (!Array.isArray(plan.clips) || plan.clips.length === 0) {
    throw new Error("[ClipCutter] Plano sem clips");
  }

  console.log("✂️ [ClipCutter] Iniciando corte de vídeo...");
  console.log(`📦 Total de clips: ${plan.clips.length}`);

  const results = [];

  // =========================
  // Loop dos clips
  // =========================
  for (const clip of plan.clips) {
    const { id, input, output, start, end } = clip;

    console.log(`✂️ Cortando ${id} (${start}s → ${end}s)`);

    const cmd = `
ffmpeg -y -i "${input}" \
-ss ${start} -to ${end} \
-c:v libx264 -preset fast -crf 18 \
-c:a aac -movflags +faststart \
"${output}"
`.trim();

    await new Promise((resolve, reject) => {
      exec(cmd, (error) => {
        if (error) {
          console.error(`❌ Erro ao cortar ${id}`);
          reject(error);
          return;
        }

        console.log(`✅ ${id} cortado com sucesso`);

        results.push({
          id,
          inputVideoPath: input,
          outputVideoPath: output,
          start,
          end,
          duration: Number((end - start).toFixed(2)),
          timeline: {
            source: "original",
            start,
            end
          }
        });

        resolve();
      });
    });
  }

  // =========================
  // Resultado final
  // =========================
  console.log(`✅ [ClipCutter] ${results.length} clips gerados com sucesso`);

  return {
    total: results.length,
    clips: results
  };
}

module.exports = ClipCutter;
