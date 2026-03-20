const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const Goal = require("../models/Goal");
const { parseMonthToBounds, materializeRecurringMonthly } = require("../utils/transactionHelpers");

function isoMonthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function getMonthTransactionsExpanded(userId, monthKey) {
  const { start, end } = parseMonthToBounds(monthKey);

  const nonRecurring = await Transaction.find({
    userId,
    recurringMonthly: false,
    date: { $gte: start, $lte: end },
  });

  const recurringTemplates = await Transaction.find({
    userId,
    recurringMonthly: true,
    date: { $lte: end },
  });

  const recurringOccurrences = [];
  for (const template of recurringTemplates) {
    const occ = materializeRecurringMonthly(template, start, end);
    recurringOccurrences.push(...occ);
  }

  return [...nonRecurring, ...recurringOccurrences];
}

function computeProgressPercent(currentSavings, targetAmount) {
  if (!targetAmount || targetAmount <= 0) return 0;
  return Math.max(0, Math.min(100, (currentSavings / targetAmount) * 100));
}

async function get(req, res) {
  const userId = req.user.id;
  const monthKey = req.query.month ? String(req.query.month) : isoMonthKey(new Date());

  const [goal, budgets, txs] = await Promise.all([
    Goal.findOne({ userId }),
    Budget.find({ userId }),
    getMonthTransactionsExpanded(userId, monthKey),
  ]);

  const totals = {
    totalIncome: txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    totalExpenses: txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
  };
  const currentSavings = totals.totalIncome - totals.totalExpenses;

  // If goal exists, use stored currentSavings for consistency; otherwise compute on the fly.
  const effectiveCurrentSavings = goal?.currentSavings ?? currentSavings;

  const progressPercent = computeProgressPercent(effectiveCurrentSavings, goal?.targetAmount || 0);

  const spentByCat = new Map();
  for (const t of txs) {
    if (t.type !== "expense") continue;
    spentByCat.set(t.category, (spentByCat.get(t.category) || 0) + t.amount);
  }

  const budgetSummaries = budgets.map((b) => {
    const spent = spentByCat.get(b.category) || 0;
    return {
      category: b.category,
      limit: b.limit,
      spentThisMonth: spent,
      remaining: b.limit - spent,
      exceeded: spent > b.limit,
    };
  });

  return res.json({
    month: monthKey,
    goal: goal
      ? {
          targetAmount: goal.targetAmount,
          currentSavings: effectiveCurrentSavings,
          progressPercent,
        }
      : null,
    budgets: budgetSummaries,
  });
}

async function updateGoal(req, res) {
  const userId = req.user.id;
  const { targetAmount } = req.body || {};
  const amt = Number(targetAmount);
  if (!Number.isFinite(amt) || amt < 0) {
    return res.status(400).json({ message: "targetAmount must be a non-negative number" });
  }

  const goal = await Goal.findOneAndUpdate(
    { userId },
    { $set: { targetAmount: amt } },
    { new: true, upsert: true }
  );

  return res.json({ goal });
}

async function upsertBudget(req, res) {
  const userId = req.user.id;
  const { category, limit } = req.body || {};
  if (!category) return res.status(400).json({ message: "category is required" });
  const lim = Number(limit);
  if (!Number.isFinite(lim) || lim < 0) return res.status(400).json({ message: "limit must be non-negative" });

  const budget = await Budget.findOneAndUpdate(
    { userId, category: String(category).trim() },
    { $set: { limit: lim } },
    { new: true, upsert: true }
  );

  return res.json({ budget });
}

async function removeBudget(req, res) {
  const userId = req.user.id;
  const category = req.params.category ? String(req.params.category).trim() : "";
  if (!category) return res.status(400).json({ message: "category is required" });

  await Budget.deleteOne({ userId, category });
  return res.json({ deleted: true });
}

module.exports = { get, updateGoal, upsertBudget, removeBudget };

