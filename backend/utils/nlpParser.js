const monthNames = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function normalizeText(text) {
  return String(text || "").toLowerCase().trim();
}

function parseAmount(text) {
  const t = String(text || "");
  const m = t.match(/(?:\$|amount\s*)?(-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/i);
  if (!m) return null;
  const raw = m[1].replaceAll(",", "");
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function parseDateISO(text, now = new Date()) {
  const t = normalizeText(text);
  if (t.includes("today")) return isoDate(now);
  if (t.includes("yesterday")) return isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  if (t.includes("tomorrow")) return isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  // YYYY-MM-DD
  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]) - 1;
    const d = Number(iso[3]);
    const dt = new Date(y, m, d, 12, 0, 0, 0);
    if (!Number.isNaN(dt.getTime())) return isoDate(dt);
  }

  // DD/MM/YYYY or MM/DD/YYYY (heuristic)
  const dm = t.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (dm) {
    const a = Number(dm[1]);
    const b = Number(dm[2]);
    const y = Number(dm[3]);
    const firstIsDay = a > 12; // if first is >12, likely day
    const day = firstIsDay ? a : b;
    const monthIndex = (firstIsDay ? b : a) - 1;
    const dt = new Date(y, monthIndex, day, 12, 0, 0, 0);
    if (!Number.isNaN(dt.getTime())) return isoDate(dt);
  }

  // "on March 5" or "5 March"
  const monthWord = Object.keys(monthNames).join("|");
  const onPat = new RegExp(`\\b(on\\s+)?(${monthWord})\\s+(\\d{1,2})\\b`, "i");
  const m1 = t.match(onPat);
  if (m1) {
    const monthIndex = monthNames[m1[2]];
    const day = Number(m1[3]);
    const dt = new Date(now.getFullYear(), monthIndex, day, 12, 0, 0, 0);
    if (!Number.isNaN(dt.getTime())) return isoDate(dt);
  }

  const dm2 = t.match(new RegExp(`\\b(\\d{1,2})\\s+(${monthWord})\\b`, "i"));
  if (dm2) {
    const day = Number(dm2[1]);
    const monthIndex = monthNames[dm2[2]];
    const dt = new Date(now.getFullYear(), monthIndex, day, 12, 0, 0, 0);
    if (!Number.isNaN(dt.getTime())) return isoDate(dt);
  }

  return isoDate(now);
}

function isoDate(d) {
  // Return YYYY-MM-DD in local time (avoid TZ surprises from toISOString).
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function detectType(text) {
  const t = normalizeText(text);
  const expenseHints = ["spent", "expense", "paid", "purchase", "bought", "rent", "bill"];
  const incomeHints = ["received", "income", "salary", "pay", "payment", "refund", "credited"];

  if (expenseHints.some((h) => t.includes(h))) return "expense";
  if (incomeHints.some((h) => t.includes(h))) return "income";

  // Default heuristic: if it looks like "spent" is absent but "on" appears, assume expense.
  if (t.includes("on")) return "expense";
  return "expense";
}

const categoryKeywords = [
  { category: "Food", keywords: ["food", "grocer", "grocery", "restaurant", "coffee", "lunch", "dinner", "breakfast", "snack"] },
  { category: "Transport", keywords: ["uber", "lyft", "fuel", "gas", "transport", "metro", "bus", "train", "parking"] },
  { category: "Housing", keywords: ["rent", "mortgage", "utilities", "electric", "water", "internet", "phone"] },
  { category: "Health", keywords: ["doctor", "pharmacy", "medicine", "hospital", "gym", "fitness", "health"] },
  { category: "Shopping", keywords: ["shopping", "clothes", "amazon", "mall"] },
  { category: "Travel", keywords: ["travel", "flight", "hotel", "airbnb"] },
  { category: "Entertainment", keywords: ["netflix", "cinema", "movie", "game", "spotify"] },
  { category: "Savings", keywords: ["savings", "investment", "401k", "index", "etf"] },
];

const incomeCategoryKeywords = [
  { category: "Salary", keywords: ["salary", "paycheck", "pay", "wages", "bonus"] },
  { category: "Refund", keywords: ["refund", "reimbursement", "chargeback"] },
  { category: "Investment Income", keywords: ["dividend", "interest", "profit"] },
];

function detectCategory(text, detectedType) {
  const t = normalizeText(text);
  const pool = detectedType === "income" ? incomeCategoryKeywords : categoryKeywords;
  const hit = pool.find((c) => c.keywords.some((k) => t.includes(k)));
  if (hit) return hit.category;
  return detectedType === "income" ? "Other Income" : "Other";
}

function parseTransactionFromText(text) {
  const type = detectType(text);
  const amount = parseAmount(text);
  if (!amount) {
    return { ok: false, message: "Could not find an amount in the text." };
  }
  const category = detectCategory(text, type);
  const dateISO = parseDateISO(text);

  return {
    ok: true,
    preview: {
      amount,
      type,
      category,
      date: dateISO,
      recurringMonthly: false,
    },
  };
}

module.exports = {
  parseTransactionFromText,
  parseAmount,
  parseDateISO,
  detectType,
  detectCategory,
};

