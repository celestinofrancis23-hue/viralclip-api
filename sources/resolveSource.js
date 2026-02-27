const resolveYouTubeSource = require('./youtubeSource');
const resolveUploadSource = require('./uploadSource');

async function resolveSource(job) {
  if (job.source.type === 'youtube') {
    return await resolveYouTubeSource(job);
  }

  if (job.source.type === 'upload') {
    return await resolveUploadSource(job);
  }

  throw new Error('Source type não suportado');
}

module.exports = resolveSource;

