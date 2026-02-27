const { spawn } = require("child_process");

/**
 * Get real video dimensions using ffprobe
 * @param {string} inputPath
 * @returns {Promise<{ width: number, height: number }>}
 */
function getVideoDimensions(inputPath) {
  return new Promise((resolve, reject) => {
    if (!inputPath) {
      return reject(new Error("getVideoDimensions: inputPath is required"));
    }

    const args = [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height",
      "-of", "json",
      inputPath
    ];

    const proc = spawn("ffprobe", args);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", d => (stdout += d.toString()));
    proc.stderr.on("data", d => (stderr += d.toString()));

    proc.on("close", code => {
      if (code !== 0) {
        return reject(
          new Error(`ffprobe failed (${code})\n${stderr}`)
        );
      }

      try {
        const json = JSON.parse(stdout);
        const stream = json.streams?.[0];

        if (!stream?.width || !stream?.height) {
          throw new Error("Invalid ffprobe output");
        }

        resolve({
          width: Number(stream.width),
          height: Number(stream.height)
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

module.exports = {
  getVideoDimensions
};
