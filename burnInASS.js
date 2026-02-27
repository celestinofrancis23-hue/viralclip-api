const { spawn } = require("child_process");
const fs = require("fs");

function burnInASS({ videoPath, assPath, outputPath }) {
  if (!fs.existsSync(videoPath)) {
    throw new Error("Vídeo não existe: " + videoPath);
  }

  if (!fs.existsSync(assPath)) {
    throw new Error("ASS não existe: " + assPath);
  }

  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i", videoPath,
      "-vf", `ass=${assPath}`,
      "-c:v", "libx264",
      "-crf", "18",
      "-preset", "veryfast",
      "-c:a", "aac",
      "-movflags", "+faststart",
      outputPath
    ];

    console.log("[FFMPEG]", args.join(" "));

    const ff = spawn("ffmpeg", args);

    ff.stderr.on("data", data => {
      console.log(data.toString());
    });

    ff.on("close", code => {
      if (code !== 0) {
        return reject(new Error("FFmpeg falhou com código " + code));
      }
      resolve(outputPath);
    });
  });
}

module.exports = { burnInASS };
