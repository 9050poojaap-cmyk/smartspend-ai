const Transaction = require("../models/Transaction");
const {
  parseMonthToBounds,
  materializeRecurringMonthly,
} = require("../utils/transactionHelpers");
const { parseDateInput } = require("../utils/parseDate");

function computeSummary(transactions) {
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  return { totalIncome, totalExpenses, savings: totalIncome - totalExpenses };
}

async function list(req, res) {
  const userId = req.user.id;
  const month = req.query.month ? String(req.query.month) : null;

  if (!month) {
    const transactions = await Transaction.find({ userId }).sort({ date: -1 });
    const summary = computeSummary(transactions);
    return res.json({ transactions, summary });
  }

  const { start, end } = parseMonthToBounds(month);

  const nonRecurring = await Transaction.find({
    userId,
    recurringMonthly: false,
    date: { $gte: start, $lte: end },
  }).sort({ date: 1 });

  const recurringTemplates = await Transaction.find({
    userId,
    recurringMonthly: true,
    date: { $lte: end },
  }).sort({ date: 1 });

  const recurringOccurrences = [];
  for (const template of recurringTemplates) {
    const occ = materializeRecurringMonthly(template, start, end);
    for (const o of occ) recurringOccurrences.push(o);
  }

  const transactions = [...nonRecurring, ...recurringOccurrences].sort((a, b) => a.date - b.date);
  const summary = computeSummary(transactions);

  return res.json({ transactions, summary, month });
}

async function create(req, res) {
  const userId = req.user.id;
  const { amount, type, category, date, recurringMonthly } = req.body || {};

  if (amount === undefined || !type || !category || !date) {
    return res.status(400).json({ message: "amount, type, category, and date are required" });
  }

  const normalizedType = type === "income" ? "income" : "expense";
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ message: "amount must be a positive number" });
  }

  const parsedTxDate = parseDateInput(date);
  if (!parsedTxDate || Number.isNaN(parsedTxDate.getTime())) {
    return res.status(400).json({ message: "date must be a valid date" });
  }

  const tx = await Transaction.create({
    userId,
    amount: parsedAmount,
    type: normalizedType,
    category: String(category).trim(),
    date: parsedTxDate,
    recurringMonthly: Boolean(recurringMonthly),
  });

  return res.status(201).json({ transaction: tx });
}

async function update(req, res) {
  const userId = req.user.id;
  const { id } = req.params;
  const { amount, type, category, date, recurringMonthly } = req.body || {};

  const update = {};
  if (amount !== undefined) update.amount = Number(amount);
  if (type) update.type = type === "income" ? "income" : "expense";
  if (category) update.category = String(category).trim();
  if (date) update.date = parseDateInput(date);
  if (recurringMonthly !== undefined) update.recurringMonthly = Boolean(recurringMonthly);

  const tx = await Transaction.findOneAndUpdate(
    { _id: id, userId },
    { $set: update },
    { new: true }
  );

  if (!tx) return res.status(404).json({ message: "Transaction not found" });
  return res.json({ transaction: tx });
}

async function remove(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  const result = await Transaction.deleteOne({ _id: id, userId });
  if (!result.deletedCount) return res.status(404).json({ message: "Transaction not found" });
  return res.json({ deleted: true });
}

module.exports = { list, create, update, remove };

