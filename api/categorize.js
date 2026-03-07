// api/categorize.js — Google Gemini API (free tier)
// Uses gemini-1.5-flash-8b which has free quota on most accounts

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY not set. Get a free key at aistudio.google.com then add it in Vercel → Settings → Environment Variables."
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

  // Try models in order — first one with free quota wins
  const models = [
    "gemini-1.5-flash-8b",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ];

  var lastError = "";

  for (var i = 0; i < models.length; i++) {
    var model = models[i];
    try {
      var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;

      var response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
        })
      });

      var data = await response.json();

      // If quota exceeded, try next model
      if (!response.ok) {
        var errMsg = (data && data.error && data.error.message) || "";
        if (errMsg.indexOf("quota") !== -1 || errMsg.indexOf("Quota") !== -1 || response.status === 429) {
          lastError = "Quota exceeded on " + model;
          continue; // try next model
        }
        return res.status(response.status).json({ error: errMsg || ("API error " + response.status) });
      }

      var raw   = ((((data.candidates || [])[0] || {}).content || {}).parts || [])[0];
      var txt   = (raw && raw.text) || "[]";
      var clean = txt.replace(/```json|```/g, "").trim();
      var parsed = JSON.parse(clean);

      return res.status(200).json({ transactions: parsed, model_used: model });

    } catch (err) {
      lastError = err.message || "Unknown error";
      continue;
    }
  }

  // All models exhausted
  return res.status(429).json({
    error: "All Gemini free tier models are over quota for today. This resets at midnight Pacific time. Try again tomorrow, or enable billing at aistudio.google.com (very cheap — ~$0.001 per statement)."
  });
};
