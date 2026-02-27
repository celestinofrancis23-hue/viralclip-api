// StartRankerDynamicSpacing.js

/**
 * Junta candidatos de todos os workers,
 * aplica prioridade + spacing dinâmico
 * e retorna inícios com endCandidate calculado.
 */

const PRIORITY = {
  strong_phrase: 4,
  natural_start: 3,
  debate_interaction: 2,
  action_energy: 1,
};

function normalizeCandidates(groups = {}) {
  const all = [];

  for (const [type, items] of Object.entries(groups)) {
    if (!Array.isArray(items)) continue;

    items.forEach((item) => {
      all.push({
        ...item,
        priority: PRIORITY[item.reason] || 0,
      });
    });
  }

  return all;
}

function sortCandidates(candidates = []) {
  return candidates.sort((a, b) => {
    // 1️⃣ prioridade
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }

    // 2️⃣ confidence
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }

    // 3️⃣ mais cedo no vídeo
    return a.start - b.start;
  });
}

function overlaps(existing, candidate, windowSize) {
  return (
    candidate.start >= existing.start &&
    candidate.start <= existing.start + windowSize
  );
}

/**
 * Ranker principal
 */
function StartRankerDynamicSpacing({
  candidatesByType,
  clipCount,
  clipLengthSeconds,
  bufferSeconds = 10,
}) {
  if (!candidatesByType || typeof candidatesByType !== "object") {
    throw new Error("[Ranker] candidatesByType inválido");
  }

  const windowSize = clipLengthSeconds + bufferSeconds;

  // 1️⃣ Normaliza e junta tudo
  const allCandidates = normalizeCandidates(candidatesByType);

  // 2️⃣ Ordena por prioridade
  const sorted = sortCandidates(allCandidates);

  const selected = [];

  // 3️⃣ Aplica spacing dinâmico
  for (const candidate of sorted) {
    if (selected.length >= clipCount) break;

    const conflict = selected.some((sel) =>
      overlaps(sel, candidate, windowSize)
    );

    if (!conflict) {
      // 🔹 cálculo do endCandidate (NÃO é corte final)
      const endCandidate =
        candidate.start + clipLengthSeconds + bufferSeconds;

      selected.push({
        start: candidate.start,
        startText: candidate.text || "",
        endCandidate,
        reason: candidate.reason,
        priority: candidate.priority,
        confidence: candidate.confidence,
      });
    }
  }

  return {
    requestedClipCount: clipCount,
    selectedCount: selected.length,
    selected,
  };
}

module.exports = StartRankerDynamicSpacing;
