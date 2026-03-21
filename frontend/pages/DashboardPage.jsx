import React, { useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
} from "chart.js";
import { Pie, Line, Bar } from "react-chartjs-2";
import { AuthContext } from "../context/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
);

function formatCurrency(n) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(n || 0);
}

function monthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function DashboardPage() {
  const { user } = useContext(AuthContext);
  const [month, setMonth] = useState(monthKey(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await api.get(
          `/api/analytics/summary?month=${encodeURIComponent(month)}`,
        );
        setData(res.data);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [month, user?.id]);

  const categoryPie = useMemo(() => {
    if (!data) return null;
    return {
      labels: data.charts.categoryPie.labels,
      datasets: [
        {
          label: "Expenses by category",
          data: data.charts.categoryPie.values,
          backgroundColor: [
            "#3b82f6",
            "#10b981",
            "#f59e0b",
            "#ef4444",
            "#8b5cf6",
            "#14b8a6",
            "#f97316",
          ],
        },
      ],
    };
  }, [data]);

  const lineChart = useMemo(() => {
    if (!data) return null;
    return {
      labels: data.charts.monthlyLine.labels,
      datasets: [
        {
          label: "Income",
          data: data.charts.monthlyLine.income,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,0.15)",
          tension: 0.35,
        },
        {
          label: "Expenses",
          data: data.charts.monthlyLine.expenses,
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.12)",
          tension: 0.35,
        },
      ],
    };
  }, [data]);

  const barChart = useMemo(() => {
    if (!data) return null;
    return {
      labels: ["This month"],
      datasets: [
        {
          label: "Income",
          data: [data.charts.incomeExpenseBar.income],
          backgroundColor: "#3b82f6",
        },
        {
          label: "Expenses",
          data: [data.charts.incomeExpenseBar.expenses],
          backgroundColor: "#ef4444",
        },
      ],
    };
  }, [data]);

  if (loading) {
    return (
      <div className="container">
        <div className="card">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="card" style={{ borderColor: "rgba(239,68,68,0.35)" }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            Error
          </div>
          <div style={{ color: "var(--danger)", fontWeight: 800 }}>{error}</div>
        </div>
      </div>
    );
  }

  const totals = data.summary;
  const savings = totals.savings;

  function exportMonthlyPDF() {
    if (!data) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("SmartSpend AI", 14, 16);
    doc.setFontSize(11);
    doc.text(`Monthly Summary`, 14, 24);
    doc.text(`Month: ${month}`, 14, 30);

    doc.text(`Total Income: ${formatCurrency(totals.totalIncome)}`, 14, 38);
    doc.text(`Total Expenses: ${formatCurrency(totals.totalExpenses)}`, 14, 46);
    doc.text(`Savings: ${formatCurrency(totals.savings)}`, 14, 54);

    const topCats = data.insights.topCategories || [];
    const tableBody = topCats.map((c) => [c.category, formatCurrency(c.total)]);

    autoTable(doc, {
      head: [["Top Category", "Total"]],
      body: tableBody.length ? tableBody : [["—", "No data"]],
      startY: 62,
      theme: "grid",
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`SmartSpendAI_${month}.pdf`);
  }

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: 14 }}>
        <div>
          <div className="section-title" style={{ marginTop: 0 }}>
            Dashboard
          </div>
          <div className="muted" style={{ fontWeight: 700 }}>
            AI insights for {month}
          </div>
        </div>

        <div style={{ minWidth: 190 }}>
          <label>Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            className="primary"
            type="button"
            onClick={exportMonthlyPDF}
            disabled={!data}
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginTop: 10 }}>
        <div className="card">
          <h3>Total Income</h3>
          <div className="big">{formatCurrency(totals.totalIncome)}</div>
        </div>
        <div className="card">
          <h3>Total Expenses</h3>
          <div className="big" style={{ color: "var(--danger)" }}>
            {formatCurrency(totals.totalExpenses)}
          </div>
        </div>
        <div className="card">
          <h3>Savings</h3>
          <div
            className="big"
            style={{ color: savings >= 0 ? "var(--success)" : "var(--danger)" }}
          >
            {formatCurrency(savings)}
          </div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <div className="card chart-wrap">
          <h3>Category Breakdown</h3>
          {categoryPie ? <Pie data={categoryPie} /> : null}
        </div>
        <div className="card chart-wrap" style={{ gridColumn: "span 2" }}>
          <h3>Monthly Trend</h3>
          {lineChart ? <Line data={lineChart} /> : null}
        </div>
      </div>

      <div className="grid" style={{ marginTop: 16 }}>
        <div className="card chart-wrap" style={{ maxWidth: 560 }}>
          <h3>Income vs Expenses</h3>
          {barChart ? <Bar data={barChart} /> : null}
        </div>
      </div>

      <div className="section-title">Insights</div>
      <div className="grid grid-3">
        <div className="card">
          <h3>Top Spending</h3>
          {data.insights.topCategories?.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {data.insights.topCategories.map((c) => (
                <div
                  key={c.category}
                  className="row"
                  style={{ justifyContent: "space-between" }}
                >
                  <div style={{ fontWeight: 900 }}>{c.category}</div>
                  <div style={{ fontWeight: 900 }}>
                    {formatCurrency(c.total)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">No expenses yet for this month.</div>
          )}
        </div>
        <div className="card">
          <h3>AI Prediction</h3>
          <div className="muted" style={{ fontWeight: 800, marginBottom: 10 }}>
            Next month estimated savings
          </div>
          <div className="big" style={{ color: "var(--success)" }}>
            {formatCurrency(data.insights.prediction.nextMonthSavings)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Based on your recent savings trend.
          </div>

          <div
            style={{
              marginTop: 12,
              borderTop: "1px solid var(--border)",
              paddingTop: 12,
            }}
          >
            <div className="muted" style={{ fontWeight: 900, fontSize: 12 }}>
              Month comparison
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Expenses:{" "}
              {Math.round(data.insights.monthComparison.expenseChangePercent)}%
              vs previous
              <br />
              Savings:{" "}
              {Math.round(data.insights.monthComparison.savingsChangePercent)}%
              vs previous
            </div>
          </div>
        </div>
        <div className="card">
          <h3>Anomalies</h3>
          {data.insights.anomalies?.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {data.insights.anomalies.map((a, idx) => (
                <div
                  key={idx}
                  style={{
                    border: "1px solid var(--border)",
                    padding: 10,
                    borderRadius: 12,
                  }}
                >
                  <div style={{ fontWeight: 900 }}>
                    {formatCurrency(a.amount)}
                  </div>
                  <div className="muted" style={{ fontWeight: 800 }}>
                    {a.category}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {a.message}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">No unusual transactions detected.</div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Smart Suggestions</h3>
        {data.insights.smartSuggestions?.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {data.insights.smartSuggestions.map((s, idx) => (
              <div
                key={idx}
                className="pill"
                style={{ justifyContent: "space-between" }}
              >
                <span style={{ fontWeight: 900 }}>{s}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">
            Keep going. Add transactions to get tailored insights.
          </div>
        )}
      </div>

      {data.budgetsAlerts?.length ? (
        <div
          className="card"
          style={{ marginTop: 16, borderColor: "rgba(245,158,11,0.35)" }}
        >
          <h3>Budget Alerts</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {data.budgetsAlerts.map((b) => (
              <div
                key={b.category}
                className="row"
                style={{ justifyContent: "space-between" }}
              >
                <div style={{ fontWeight: 900 }}>{b.category}</div>
                <div style={{ fontWeight: 900, color: "var(--warning)" }}>
                  Spent {formatCurrency(b.spent)} / {formatCurrency(b.limit)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
