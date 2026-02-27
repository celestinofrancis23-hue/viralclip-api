const fs = require('fs');
const path = require('path');

async function resolveUploadSource(job) {
  const sourcePath = job.source.path;

  if (!fs.existsSync(sourcePath)) {
    throw new Error('Arquivo de upload não encontrado');
  }

  return {
    type: 'upload',
    path: sourcePath,
    filename: path.basename(sourcePath),
  };
}

module.exports = resolveUploadSource;
