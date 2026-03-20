import React, { useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";

const EXPENSE_CATEGORIES = ["Food", "Transport", "Housing", "Health", "Shopping", "Travel", "Entertainment", "Savings", "Other"];

export default function BudgetGoalsPage() {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const [targetAmount, setTargetAmount] = useState("");
  const [savingGoalSubmitting, setSavingGoalSubmitting] = useState(false);

  const [categoryEdits, setCategoryEdits] = useState({});
  const [submittingCategory, setSubmittingCategory] = useState("");

  const month = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/api/budget-goals`);
        setData(res.data);
        setTargetAmount(res.data.goal?.targetAmount ?? "");
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load goals/budgets");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function saveGoal() {
    const amt = Number(targetAmount);
    if (!Number.isFinite(amt) || amt < 0) {
      setError("Target amount must be a non-negative number.");
      return;
    }
    setSavingGoalSubmitting(true);
    setError("");
    try {
      await api.put("/api/budget-goals/goal", { targetAmount: amt });
      const res = await api.get(`/api/budget-goals`);
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save goal");
    } finally {
      setSavingGoalSubmitting(false);
    }
  }

  function setLimit(category, value) {
    setCategoryEdits((prev) => ({ ...prev, [category]: value }));
  }

  async function saveBudget(category) {
    const val = Number(categoryEdits[category]);
    if (!Number.isFinite(val) || val < 0) {
      setError("Budget limit must be a non-negative number.");
      return;
    }
    setSubmittingCategory(category);
    setError("");
    try {
      await api.put("/api/budget-goals/budgets", { category, limit: val });
      const res = await api.get(`/api/budget-goals`);
      setData(res.data);
      setCategoryEdits((prev) => ({ ...prev, [category]: "" }));
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save budget");
    } finally {
      setSubmittingCategory("");
    }
  }

  async function deleteBudget(category) {
    setError("");
    try {
      await api.delete(`/api/budget-goals/budgets/${encodeURIComponent(category)}`);
      const res = await api.get(`/api/budget-goals`);
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete budget");
    }
  }

  if (loading) return <div className="container"><div className="card">Loading goals & budgets...</div></div>;

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: 14 }}>
        <div>
          <div className="section-title" style={{ marginTop: 0 }}>Goals & Budgets</div>
          <div className="muted" style={{ fontWeight: 800 }}>Plan your savings target and category limits</div>
        </div>
        <div style={{ minWidth: 160 }}>
          <label>Month</label>
          <input type="text" readOnly value={month} />
        </div>
      </div>

      {error ? (
        <div className="card" style={{ borderColor: "rgba(239,68,68,0.3)" }}>
          <div style={{ color: "var(--danger)", fontWeight: 900 }}>{error}</div>
        </div>
      ) : null}

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        {/* GOAL CARD */}
        <div className="card" style={{ gridColumn: "span 1" }}>
          <h3>Saving Goal</h3>

          <div className="big">
            {(data?.goal?.currentSavings || 0).toFixed(2)}
          </div>

          <div className="muted" style={{ marginTop: 4, fontWeight: 800 }}>
            of {(data?.goal?.targetAmount || 0).toFixed(2)}
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 900 }}>Progress</div>
            <div style={{ height: 10, borderRadius: 999, background: "var(--border)", overflow: "hidden", marginTop: 6 }}>
              <div style={{ width: `${data?.goal?.progressPercent || 0}%`, height: "100%", background: "var(--primary)" }} />
            </div>
            <div className="muted" style={{ marginTop: 8, fontSize: 12, fontWeight: 900 }}>
              {Math.round(data?.goal?.progressPercent || 0)}%
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label>Update target amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
            />
          </div>

          <button className="primary" type="button" onClick={saveGoal} disabled={savingGoalSubmitting} style={{ marginTop: 10 }}>
            {savingGoalSubmitting ? "Saving..." : "Save goal"}
          </button>
        </div>

        {/* BUDGETS */}
        <div className="card" style={{ gridColumn: "span 2" }}>
          <h3>Budget Limits (Category-wise)</h3>

          <div style={{ display: "grid", gap: 12 }}>
            {EXPENSE_CATEGORIES.map((cat) => {
              const existing = data?.budgets?.find((b) => b.category === cat);
              const spent = existing?.spentThisMonth ?? 0;
              const limit = existing?.limit ?? 0;
              const exceeded = existing?.exceeded ?? false;

              return (
                <div key={cat} className="row" style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 12 }}>
                  <div style={{ minWidth: 190 }}>
                    <div style={{ fontWeight: 900 }}>{cat}</div>
                    <div className="muted">
                      Spent: {(spent || 0).toFixed(2)} / {(limit || 0).toFixed(2)}
                      {exceeded && <span style={{ color: "var(--warning)" }}> (exceeded)</span>}
                    </div>
                  </div>

                  <input
                    type="number"
                    placeholder="Set limit"
                    value={categoryEdits[cat] ?? ""}
                    onChange={(e) => setLimit(cat, e.target.value)}
                  />

                  <button onClick={() => saveBudget(cat)}>
                    {existing ? "Update" : "Add"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}