const FaceDominanceAnalyzer = require(
  "../workers/verticalCropEngine/analyzers/FaceDominanceAnalyzer"
);

(async () => {
  const result = await FaceDominanceAnalyzer({
    clipPath: "/fake/path/clip.mp4",
    speakerTimeline: [
      { start: 2, end: 5, duration: 3 },
      { start: 10, end: 15, duration: 5 }
    ]
  });

  console.log(JSON.stringify(result, null, 2));
})();
