// controllers/generateClips.controller.js

const CaptionEngine = require('../services/captionEngine');

module.exports = async function generateClipsController(req, res) {
  try {
    const result = await CaptionEngine(req.body);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
