// api/debug.js — CommonJS, temporary diagnostic endpoint
module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  var keys = Object.keys(process.env).filter(function(k) {
    return k.indexOf("ANTHROPIC") !== -1 || k.indexOf("VITE") !== -1;
  });
  res.status(200).json({
    found_keys:    keys,
    has_anthropic: !!process.env.ANTHROPIC_API_KEY,
    has_vite:      !!process.env.VITE_ANTHROPIC_API_KEY,
    key_preview:   (process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || "NONE").slice(0, 12) + "...",
    node_version:  process.version,
  });
};
