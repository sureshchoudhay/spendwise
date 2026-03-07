// api/categorize.js — Uses Google Gemini API (free tier, no credit card needed)
// Get your free key at: https://aistudio.google.com/app/apikey

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY || "";

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY not set. Get a free key at aistudio.google.com → Get API Key. Then add it in Vercel → Settings → Environment Variables → GEMINI_API_KEY."
    });
  }

  const body = req.body || {};
  const text = body.text;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing text in request body" });
  }

  const prompt =
    "You are a financial categorization assistant. Extract spending transactions from this bank statement.\n\n" +
    "Available categories: food, transport, shopping, entertainment, health, utilities, travel, groceries, education, others\n\n" +
    "Bank statement text:\n" + text.slice(0, 4000) + "\n\n" +
    "Return ONLY a valid JSON array, no markdown, no explanation:\n" +
    '[{"description":"merchant name","amount":25.50,"category":"food","date":"2024-01-15"}]\n\n' +
    "Rules:\n" +
    "- amount: positive number only\n" +
    "- date: YYYY-MM-DD, use current year if missing\n" +
    "- Skip headers, totals, opening/closing balances, credits/refunds\n" +
    "- Only include debit/spending transactions";

  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
      })
    });

    if (!response.ok) {
      const e = await response.json().catch(() => ({}));
      const msg = (e && e.error && e.error.message) || ("Gemini API error " + response.status);
      return res.status(response.status).json({ error: msg });
    }

    const data  = await response.json();
    const raw   = ((((data.candidates || [])[0] || {}).content || {}).parts || [])[0];
    const txt   = (raw && raw.text) || "[]";
    const clean = txt.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({ transactions: parsed });

  } catch (err) {
    console.error("categorize error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
