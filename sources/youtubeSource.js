async function resolveYouTubeSource(job) {
  const url = job.source.url;

  console.log('🎬 Resolvendo YouTube:', url);

  // mock por enquanto (ETAPA 5 vem depois)
  return {
    type: 'youtube',
    originalUrl: url,
    videoId: 'mock-video-id',
    title: job.title || 'YouTube Video',
    thumbnail: job.thumbnail,
  };
}

module.exports = resolveYouTubeSource;

