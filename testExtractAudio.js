const extractAudioFromVideo = require('./services/extractAudioFromVideo');

(async () => {
  try {
    const result = await extractAudioFromVideo({
      inputVideoPath: './vertical_clips/02009a70-d437-4aad-90ea-0f97ecb7d6e4/vertical_clip_5.mp4',
      outputAudioPath: './audio/SEU_CLIP.wav'
    });

    console.log('Áudio extraído com sucesso:', result.audioPath);
  } catch (err) {
    console.error(err.message);
  }
})();
