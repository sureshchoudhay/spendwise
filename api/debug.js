module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    has_gemini:   !!process.env.GEMINI_API_KEY,
    key_preview:  (process.env.GEMINI_API_KEY || "NOT SET").slice(0, 8) + "...",
    node_version: process.version,
  });
};
