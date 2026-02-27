// validators/validateJobContract.js

function validateJobContract(job) {
  if (!job || typeof job !== "object") {
    throw new Error("Job inválido ou vazio");
  }

  // ======================
  // jobId
  // ======================
  if (!job.jobId || typeof job.jobId !== "string") {
    throw new Error("jobId é obrigatório e deve ser string");
  }

  // ======================
  // source
  // ======================
  if (!job.source || typeof job.source !== "object") {
    throw new Error("source é obrigatório");
  }

  if (!["youtube", "upload"].includes(job.source.type)) {
    throw new Error("source.type inválido");
  }

  if (job.source.type === "youtube" && !job.source.url) {
    throw new Error("source.url é obrigatório para YouTube");
  }

  if (job.source.type === "upload" && !job.source.path) {
    throw new Error("source.path é obrigatório para upload");
  }

  // ======================
  // settings
  // ======================
  if (!job.settings || typeof job.settings !== "object") {
    throw new Error("settings é obrigatório");
  }

  if (!["Viral Moment", "Manual"].includes(job.settings.mode)) {
    throw new Error("settings.mode inválido");
  }

  if (
    typeof job.settings.clipLength !== "number" ||
    job.settings.clipLength <= 0
  ) {
    throw new Error("settings.clipLength inválido");
  }

  if (
    typeof job.settings.clipCount !== "number" ||
    job.settings.clipCount <= 0
  ) {
    throw new Error("settings.clipCount inválido");
  }

  if (typeof job.settings.captions !== "boolean") {
    throw new Error("settings.captions deve ser boolean");
  }

  // ======================
  // template (opcional, mas validado se existir)
  // ======================
  if (job.template && typeof job.template.slug !== "string") {
    throw new Error("template.slug inválido");
  }

  return true;
}

module.exports = validateJobContract;

