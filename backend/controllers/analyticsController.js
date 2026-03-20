const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const Goal = require("../models/Goal");
const {
  parseMonthToBounds,
  materializeRecurringMonthly,
  listMonthKeys,
} = require("../utils/transactionHelpers");

function sumByType(transactions) {
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return { totalIncome, totalExpenses, savings: totalIncome - totalExpenses };
}

function groupExpensesByCategory(transactions) {
  const map = new Map();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    map.set(t.category, (map.get(t.category) || 0) + t.amount);
  }
  const out = Array.from(map.entries()).map(([category, total]) => ({ category, total }));
  out.sort((a, b) => b.total - a.total);
  return out;
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(variance);
}

function linearRegressionPredict(values) {
  // x = 0..n-1, predict at x=n
  const n = values.length;
  if (n < 2) return values[values.length - 1] || 0;
  const xs = values.map((_, i) => i);
  const xMean = mean(xs);
  const yMean = mean(values);
  const num = xs.reduce((s, x, i) => s + (x - xMean) * (values[i] - yMean), 0);
  const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return slope * n + intercept;
}

function isoMonthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function percentChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

async function summary(req, res) {
  const userId = req.user.id;
  const monthKey = req.query.month ? String(req.query.month) : isoMonthKey(new Date());

  const reference = parseMonthToBounds(monthKey);

  // last 6 months including reference month
  const [yStr, mStr] = monthKey.split("-").map((x) => Number(x));
  const refDate = new Date(yStr, mStr - 1, 1);
  const monthKeys = listMonthKeys(refDate, 6); // oldest -> newest? listMonthKeys returns descending then push; ensure order
  monthKeys.sort(); // YYYY-MM sorts lexicographically

  const firstKey = monthKeys[0];
  const lastKey = monthKeys[monthKeys.length - 1];
  const { start: rangeStart } = parseMonthToBounds(firstKey);
  const { end: rangeEnd } = parseMonthToBounds(lastKey);

  const [nonRecurring, recurringTemplates] = await Promise.all([
    Transaction.find({
      userId,
      recurringMonthly: false,
      date: { $gte: rangeStart, $lte: rangeEnd },
    }),
    Transaction.find({
      userId,
      recurringMonthly: true,
      date: { $lte: rangeEnd },
    }),
  ]);

  const transactionsByMonth = new Map();
  for (const mk of monthKeys) {
    const { start, end } = parseMonthToBounds(mk);
    const nonRecForMonth = nonRecurring.filter((t) => t.date >= start && t.date <= end);
    const recOcc = [];
    for (const template of recurringTemplates) {
      const occ = materializeRecurringMonthly(template, start, end);
      for (const o of occ) recOcc.push(o);
    }
    transactionsByMonth.set(mk, [...nonRecForMonth, ...recOcc]);
  }

  const currentMonthTx = transactionsByMonth.get(monthKey) || [];
  const currentTotals = sumByType(currentMonthTx);

  const previousMonthKey = monthKeys[monthKeys.indexOf(monthKey) - 1] || isoMonthKey(new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1));
  const previousTx = transactionsByMonth.get(previousMonthKey) || [];
  const previousTotals = sumByType(previousTx);

  const expensesGrouped = groupExpensesByCategory(currentMonthTx);
  const topCategories = expensesGrouped.slice(0, 5);

  const categoryPie = expensesGrouped.length
    ? {
        labels: expensesGrouped.map((x) => x.category),
        values: expensesGrouped.map((x) => x.total),
      }
    : { labels: [], values: [] };

  const monthlySeries = monthKeys.map((mk) => {
    const tx = transactionsByMonth.get(mk) || [];
    const t = sumByType(tx);
    return { mk, income: t.totalIncome, expenses: t.totalExpenses, savings: t.savings };
  });

  const labels = monthlySeries.map((s) => s.mk);
  const incomeSeries = monthlySeries.map((s) => s.income);
  const expensesSeries = monthlySeries.map((s) => s.expenses);
  const savingsSeries = monthlySeries.map((s) => s.savings);

  const predictionBase = savingsSeries.slice(-3);
  const avgPrediction = mean(predictionBase);
  const lrPrediction = linearRegressionPredict(predictionBase);
  const nextMonthSavings = Math.round((avgPrediction + lrPrediction) / 2);

  // Anomalies: unusually high expenses this month
  const expenseAmounts = currentMonthTx.filter((t) => t.type === "expense").map((t) => t.amount);
  const m = mean(expenseAmounts);
  const sd = stddev(expenseAmounts);
  const threshold = m + 2 * sd;
  const anomalies = currentMonthTx
    .filter((t) => t.type === "expense")
    .filter((t) => (sd > 0 ? t.amount > threshold : false))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((t) => ({
      id: t._id?.toString?.() || t._id,
      amount: t.amount,
      category: t.category,
      date: t.date,
      message: `Unusually high expense vs your recent average.`,
    }));

  // Smart suggestions: simple heuristics
  const currentByCategory = groupExpensesByCategory(currentMonthTx);
  const prevByCategory = groupExpensesByCategory(previousTx);
  const prevMap = new Map(prevByCategory.map((x) => [x.category, x.total]));

  const smartSuggestions = [];
  for (const { category, total } of currentByCategory.slice(0, 8)) {
    const prevTotal = prevMap.get(category) || 0;
    if (prevTotal === 0) continue;
    const pct = percentChange(total, prevTotal);
    if (pct > 15) {
      const reducePct = Math.min(30, Math.round((pct / 10) * 10) / 10); // heuristic
      smartSuggestions.push(`Reduce ${category.toLowerCase()} spending by ~${reducePct}%`);
    }
  }
  if (currentTotals.savings < 0) {
    smartSuggestions.push(`Your expenses are exceeding income this month. Consider cutting non-essential categories.`);
  }

  // Budgets alerts
  const budgets = await Budget.find({ userId });
  const budgetAlerts = [];
  if (budgets.length) {
    const expenseByCat = groupExpensesByCategory(currentMonthTx);
    const expenseMap = new Map(expenseByCat.map((x) => [x.category, x.total]));

    for (const b of budgets) {
      const spent = expenseMap.get(b.category) || 0;
      const exceeded = spent > b.limit;
      if (exceeded) {
        budgetAlerts.push({
          category: b.category,
          limit: b.limit,
          spent,
          remaining: b.limit - spent,
          exceededByPercent: b.limit === 0 ? 100 : ((spent - b.limit) / b.limit) * 100,
        });
      }
    }
  }

  // Keep goal "currentSavings" in sync (simple: current month savings)
  // (Not failing analytics if goal doesn't exist)
  await Goal.updateOne(
    { userId },
    { $set: { currentSavings: currentTotals.savings } },
    { upsert: true }
  );

  return res.json({
    month: monthKey,
    summary: currentTotals,
    charts: {
      categoryPie,
      monthlyLine: { labels, income: incomeSeries, expenses: expensesSeries, savings: savingsSeries },
      incomeExpenseBar: { income: currentTotals.totalIncome, expenses: currentTotals.totalExpenses },
    },
    insights: {
      topCategories,
      monthComparison: {
        previousMonth: previousMonthKey,
        current: currentTotals,
        previous: previousTotals,
        expenseChangePercent: percentChange(currentTotals.totalExpenses, previousTotals.totalExpenses),
        incomeChangePercent: percentChange(currentTotals.totalIncome, previousTotals.totalIncome),
        savingsChangePercent: percentChange(currentTotals.savings, previousTotals.savings),
      },
      prediction: { nextMonthSavings },
      anomalies,
      smartSuggestions,
    },
    budgetsAlerts: budgetAlerts,
  });
}

module.exports = { summary };

