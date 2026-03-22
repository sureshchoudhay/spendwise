const CATEGORIES = ["food","transport","shopping","entertainment","health","utilities","travel","groceries","education","others"];

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: "No text provided" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

  const prompt = `Extract all expense transactions from this bank statement text. For each transaction return JSON with: date (YYYY-MM-DD), description (merchant name, clean), amount (number, positive), category (one of: ${CATEGORIES.join(",")}). Return ONLY a JSON array, no markdown, no explanation.\n\nStatement:\n${text.slice(0,8000)}`;

  const models = ["gemini-2.0-flash","gemini-1.5-flash-8b","gemini-1.5-flash","gemini-1.5-pro"];
  let lastErr;
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ contents:[{ parts:[{ text: prompt }] }], generationConfig:{ temperature:0.1, maxOutputTokens:4096 } })
      });
      const d = await r.json();
      if (!r.ok) { lastErr = d.error?.message || r.statusText; continue; }
      let raw = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
      raw = raw.replace(/```json|```/g,"").trim();
      const transactions = JSON.parse(raw);
      if (!Array.isArray(transactions)) throw new Error("Not an array");
      return res.status(200).json({ transactions });
    } catch(e) { lastErr = e.message; }
  }
  return res.status(500).json({ error: lastErr || "All models failed" });
};
