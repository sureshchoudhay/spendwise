// api/categorize.js
// Vercel Serverless Function — proxies Anthropic API requests server-side.
// IMPORTANT: Uses ANTHROPIC_API_KEY (no VITE_ prefix) because VITE_ variables
// are build-time only and are NOT available in serverless functions at runtime.

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Works whether you set ANTHROPIC_API_KEY or VITE_ANTHROPIC_API_KEY in Vercel
  const apiKey =
    process.env.ANTHROPIC_API_KEY ||
    process.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error:
        "API key not set. In Vercel → your project → Settings → Environment Variables, add ANTHROPIC_API_KEY = sk-ant-... then Redeploy.",
    });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing text field in request body" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `You are a financial categorization assistant. Extract spending transactions from this bank statement and categorize each one.

Available categories: food, transport, shopping, entertainment, health, utilities, travel, groceries, education, others

Bank statement text:
${text.slice(0, 4000)}

Return ONLY a valid JSON array, no markdown, no explanation:
[{"description":"merchant name","amount":25.50,"category":"food","date":"2024-01-15"}]

Rules:
- amount: positive number only
- date: YYYY-MM-DD format, use current year if missing
- Skip headers, totals, opening/closing balances, credits/refunds
- Only include debit/spending transactions`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errBody?.error?.message || `Anthropic API returned ${response.status}`,
      });
    }

    const data   = await response.json();
    const raw    = data.content?.find((b) => b.type === "text")?.text ?? "[]";
    const clean  = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({ transactions: parsed });
  } catch (err) {
    console.error("categorize error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
