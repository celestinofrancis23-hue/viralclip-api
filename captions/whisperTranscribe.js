const fs = require('fs');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function whisperTranscribe(videoPath, language = 'auto') {
  console.log('📝 Transcrevendo com Whisper...');

  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(videoPath),
    model: 'gpt-4o-transcribe',
    response_format: 'verbose_json',
    language: language === 'auto' ? undefined : language,
  });

  console.log('✅ Transcrição concluída');
  return transcription; // contém segments
}

module.exports = whisperTranscribe;
