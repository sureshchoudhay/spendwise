// api/categorize.js  — CommonJS format (required since package.json has no "type":"module")

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const apiKey =
    process.env.ANTHROPIC_API_KEY ||
    process.env.VITE_ANTHROPIC_API_KEY ||
    "";

  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY not found in environment. Go to Vercel → your project → Settings → Environment Variables → add ANTHROPIC_API_KEY = sk-ant-... → Save → then Redeploy."
    });
  }

  const body = req.body || {};
  const text = body.text;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing text in request body" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content:
            "You are a financial categorization assistant. Extract spending transactions from this bank statement.\n\n" +
            "Available categories: food, transport, shopping, entertainment, health, utilities, travel, groceries, education, others\n\n" +
            "Bank statement text:\n" + text.slice(0, 4000) + "\n\n" +
            "Return ONLY a valid JSON array, no markdown, no explanation:\n" +
            '[{"description":"merchant name","amount":25.50,"category":"food","date":"2024-01-15"}]\n\n' +
            "Rules:\n" +
            "- amount: positive number only\n" +
            "- date: YYYY-MM-DD, use current year if missing\n" +
            "- Skip headers, totals, opening/closing balances, credits/refunds\n" +
            "- Only include debit/spending transactions"
        }]
      })
    });

    if (!response.ok) {
      const e = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: (e && e.error && e.error.message) || ("Anthropic API error " + response.status)
      });
    }

    const data   = await response.json();
    const block  = (data.content || []).find(function(b) { return b.type === "text"; });
    const raw    = (block && block.text) || "[]";
    const clean  = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({ transactions: parsed });

  } catch (err) {
    console.error("categorize:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
