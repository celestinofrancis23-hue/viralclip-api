const fs = require('fs');
const path = require('path');

/**
 * Prepara e valida clips antes do crop
 * @param {string[]} clips
 * @returns {Array<{index:number, clipPath:string, exists:boolean}>}
 */
function prepareClips(clips = []) {
  if (!Array.isArray(clips)) {
    throw new Error('prepareClips: clips não é um array');
  }

  const prepared = clips.map((clipPath, index) => {
    const resolvedPath = path.resolve(clipPath);
    const exists = fs.existsSync(resolvedPath);

    if (!exists) {
      console.warn(`⚠️ Clip não encontrado: ${resolvedPath}`);
    }

    return {
      index,
      clipPath: resolvedPath,
      exists
    };
  });

  const validClips = prepared.filter(c => c.exists);

  if (validClips.length === 0) {
    throw new Error('Nenhum clip válido após prepareClips');
  }

  console.log(`🔗 MergeClips: ${validClips.length} clips prontos para crop`);

  return validClips;
}

module.exports = prepareClips;
