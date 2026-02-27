const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

module.exports = function ClipThumbnailWorker({
  videoPath,
  jobDir
}) {
  return new Promise((resolve, reject) => {

    if (!fs.existsSync(videoPath)) {
      return reject(
        new Error("Video não encontrado para thumbnail: " + videoPath)
      );
    }

    const baseName = path.basename(videoPath, path.extname(videoPath));
    const thumbPath = path.join(jobDir, `${baseName}_thumb.jpg`);

    // Pegamos frame no segundo 1
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-ss", "00:00:01",
      "-i", videoPath,
      "-vframes", "1",
      "-q:v", "2",
      thumbPath
    ]);

    ffmpeg.stderr.on("data", () => {}); // evita poluição log

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error("Erro ao gerar thumbnail")
        );
      }

      resolve(thumbPath);
    });
  });
};
