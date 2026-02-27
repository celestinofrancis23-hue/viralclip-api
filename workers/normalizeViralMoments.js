/**
 * normalizeViralMoments
 * ---------------------
 * Recebe o output bruto do ViralMomentAnalyzer
 * e garante um formato consistente para toda a pipeline.
 */

module.exports = function normalizeViralMoments(rawMoments = []) {
  if (!Array.isArray(rawMoments)) {
    throw new Error("[normalizeViralMoments] rawMoments não é um array");
  }

  const normalized = [];

  rawMoments.forEach((moment, index) => {
    const start =
      moment.startTime ??
      moment.start ??
      moment.startCandidate;

    const end =
      moment.endTime ??
      moment.end ??
      moment.endCandidate;

    if (
      typeof start !== "number" ||
      typeof end !== "number" ||
      end <= start
    ) {
      console.warn(
        `[normalizeViralMoments] ⚠️ Momento ${index} ignorado (tempos inválidos)`
      );
      return;
    }

    normalized.push({
      clipIndex: index,
      startTime: start,
      endTime: end,
      duration: Number((end - start).toFixed(2)),
      reason: moment.reason || "unknown",
      confidence: moment.confidence ?? null,
      priority: moment.priority ?? null,
    });
  });

  console.log(
    `🧩 Viral moments normalizados: ${normalized.length}`
  );

  return normalized;
};
