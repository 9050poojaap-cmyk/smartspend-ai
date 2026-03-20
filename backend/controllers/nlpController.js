const { parseTransactionFromText, parseAmount } = require("../utils/nlpParser");

function computeConfidence(text, preview) {
  const t = String(text || "").toLowerCase();
  let score = 0.15;
  if (preview.amount) score += 0.45;
  if (t.includes("spent") || t.includes("paid") || t.includes("received") || t.includes("salary")) score += 0.15;
  if (preview.category && preview.category !== "Other" && preview.category !== "Other Income") score += 0.15;
  if (/(today|yesterday|tomorrow)/.test(t)) score += 0.1;
  return Math.min(0.98, Math.max(0.05, score));
}

async function parse(req, res) {
  const { text } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ message: "text is required" });
  }

  const parsed = parseTransactionFromText(text);
  if (!parsed.ok) {
    return res.status(400).json({ message: parsed.message });
  }

  const preview = parsed.preview;
  const confidence = computeConfidence(text, preview);

  return res.json({
    preview: {
      ...preview,
      confidence,
      rawAmount: parseAmount(text),
    },
  });
}

module.exports = { parse };

