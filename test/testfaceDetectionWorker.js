const faceDetectionWorker = require("./workers/faceDetectionWorker");

const result = await faceDetectionWorker({
  videoPath: "/path/to/clip.mp4"
});

console.log(result.frames.length);
console.log(result.frames[0]);
