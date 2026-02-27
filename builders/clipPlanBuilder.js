const fs = require("fs");
const path = require("path");

/**
 * ClipPlanBuilder
 * Cria um plano de corte estruturado para o ClipCutter
 */
function ClipPlanBuilder({
  videoPath,
  selectedClips,
  jobId,
  jobDir,
  settings = {}
}) {
  if (!videoPath) {
    throw new Error("[ClipPlanBuilder] videoPath não fornecido");
  }

  if (!Array.isArray(selectedClips) || selectedClips.length === 0) {
    throw new Error("[ClipPlanBuilder] selectedClips inválido ou vazio");
  }

  const verticalClipsDir = path.join(jobDir, "vertical_clips");
  const plansDir = path.join(jobDir, "plans");

  // Garantir diretórios
  fs.mkdirSync(verticalClipsDir, { recursive: true });
  fs.mkdirSync(plansDir, { recursive: true });

  console.log("🧩 [ClipPlanBuilder] Criando plano de corte...");

  const clips = selectedClips.map((clip, index) => {
    const clipIndex = index + 1;
    const clipId = `clip_${clipIndex}`;

    const start = Number(clip.start);
    const end = Number(clip.end);

    if (isNaN(start) || isNaN(end)) {
      throw new Error(
        `[ClipPlanBuilder] Clip inválido no índice ${index}`
      );
    }

    return {
      id: clipId,
      input: videoPath,
      output: path.join(verticalClipsDir, `${clipId}.mp4`),
      start,
      end,
      duration: Number((end - start).toFixed(2)),
      index: clipIndex
    };
  });

  const plan = {
    jobId,
    createdAt: new Date().toISOString(),
    mode: settings.mode || null,
    clipLength: settings.clipLength || null,
    totalClips: clips.length,
    clips
  };

  const planPath = path.join(plansDir, "clip_plan.json");

  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));

  console.log("✅ [ClipPlanBuilder] Plano criado com sucesso");
  console.log(`📄 Plano salvo em: ${planPath}`);
  console.log(`🎬 Clips aprovados: ${clips.length}`);

  return {
    planPath,
    plan
  };
}

module.exports = ClipPlanBuilder;
