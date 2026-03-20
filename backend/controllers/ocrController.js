const { createWorker } = require("tesseract.js");
const {
  parseAmount,
  parseDateISO,
  detectType,
  detectCategory,
} = require("../utils/nlpParser");

let workerPromise = null;

async function getWorker() {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    const worker = await createWorker("eng");
    // Ensure language resources are loaded/initialized.
    if (worker.loadLanguage) {
      await worker.loadLanguage("eng");
    }
    if (worker.initialize) {
      await worker.initialize("eng");
    }
    return worker;
  })();
  return workerPromise;
}

function computeConfidenceFromOCR(text, amount) {
  const t = String(text || "");
  let score = 0.1;
  if (amount) score += 0.5;
  if (t.length > 30) score += 0.15;
  if (/(total|amount|subtotal)/i.test(t)) score += 0.15;
  return Math.min(0.95, Math.max(0.05, score));
}

async function parse(req, res) {
  const userId = req.user?.id; // used only for symmetry; parsing itself doesn't write DB
  void userId;

  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ message: "image file is required (field name: image)" });
  }

  try {
    const worker = await getWorker();
    const result = await worker.recognize(req.file.buffer);
    const extractedText = result?.data?.text || "";

    const amount = parseAmount(extractedText);
    if (!amount) {
      return res.status(400).json({ message: "Could not detect an amount from the receipt." });
    }

    const type = detectType(extractedText);
    const category = detectCategory(extractedText, type);
    const date = parseDateISO(extractedText);
    const confidence = computeConfidenceFromOCR(extractedText, amount);

    return res.json({
      preview: {
        amount,
        type,
        category,
        date,
        recurringMonthly: false,
        confidence,
      },
      extractedText,
    });
  } catch (err) {
    return res.status(500).json({ message: "OCR processing failed", detail: String(err.message || err) });
  }
}

module.exports = { parse };

