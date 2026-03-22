module.exports = (req, res) => {
  res.json({ ok: true, hasGeminiKey: !!process.env.GEMINI_API_KEY, time: new Date().toISOString() });
};
