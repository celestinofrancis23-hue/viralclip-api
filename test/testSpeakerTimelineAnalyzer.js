const SpeakerTimelineAnalyzer = require(
  "../workers/verticalCropEngine/analyzers/SpeakerTimelineAnalyzer"
);

const input = {
  clipTranscriptSegments: [
    { start: 2, end: 5, text: "Olá pessoal" },
    { start: 10, end: 15, text: "Bem-vindos" }
  ],
  clipDuration: 40
};

const result = SpeakerTimelineAnalyzer(input);

console.log(JSON.stringify(result, null, 2));
