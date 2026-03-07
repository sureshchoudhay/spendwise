// Temporary debug endpoint — DELETE after fixing
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const keys = Object.keys(process.env).filter(k =>
    k.includes("ANTHROPIC") || k.includes("VITE")
  );
  res.status(200).json({
    found_keys: keys,
    node_env: process.env.NODE_ENV,
    has_anthropic: !!process.env.ANTHROPIC_API_KEY,
    has_vite: !!process.env.VITE_ANTHROPIC_API_KEY,
    key_preview: (process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || "").slice(0, 10) + "...",
  });
}
