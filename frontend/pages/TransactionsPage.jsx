import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api";

const CATEGORIES = [
  "Food",
  "Transport",
  "Housing",
  "Health",
  "Shopping",
  "Travel",
  "Entertainment",
  "Savings",
  "Salary",
  "Refund",
  "Investment Income",
  "Other",
  "Other Income",
];

function formatCurrency(n) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
  }).format(n || 0);
}

function monthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function isoToInputDate(isoDate) {
  return isoDate ? String(isoDate).slice(0, 10) : "";
}

function inputDateToISO(dateStr) {
  // dateStr already YYYY-MM-DD from <input type="date" />
  return dateStr ? String(dateStr) : "";
}

function PreviewEditor({ preview, onChange, onConfirm, confirmLabel }) {
  if (!preview) return null;
  return (
    <div
      className="card"
      style={{ marginTop: 16, borderColor: "rgba(59,130,246,0.25)" }}
    >
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="section-title" style={{ margin: "0 0 8px 0" }}>
            Preview (confirm to save)
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Confidence:{" "}
            {preview.confidence
              ? `${Math.round(preview.confidence * 100)}%`
              : "—"}
          </div>
        </div>
        <button className="primary" type="button" onClick={onConfirm}>
          {confirmLabel || "Save transaction"}
        </button>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12 }}
      >
        <div>
          <label>Type</label>
          <select
            value={preview.type}
            onChange={(e) => onChange({ ...preview, type: e.target.value })}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        <div>
          <label>Amount</label>
          <input
            value={preview.amount}
            onChange={(e) =>
              onChange({ ...preview, amount: Number(e.target.value) })
            }
            type="number"
            step="0.01"
            min="0"
          />
        </div>
        <div>
          <label>Category</label>
          <select
            value={preview.category}
            onChange={(e) => onChange({ ...preview, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Date</label>
          <input
            type="date"
            value={isoToInputDate(preview.date)}
            onChange={(e) =>
              onChange({ ...preview, date: inputDateToISO(e.target.value) })
            }
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginBottom: 0,
          }}
        >
          <input
            type="checkbox"
            checked={Boolean(preview.recurringMonthly)}
            onChange={(e) =>
              onChange({ ...preview, recurringMonthly: e.target.checked })
            }
          />
          Recurring monthly
        </label>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const [month, setMonth] = useState(monthKey(new Date()));
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    id: "",
    amount: "",
    type: "expense",
    category: "Food",
    date: month + "-01",
    recurringMonthly: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const [nlpText, setNlpText] = useState("");
  const [nlpPreview, setNlpPreview] = useState(null);
  const [nlpLoading, setNlpLoading] = useState(false);

  const [voiceText, setVoiceText] = useState("");
  const [voiceListening, setVoiceListening] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrPreview, setOcrPreview] = useState(null);
  const [ocrText, setOcrText] = useState("");

  const canEdit = Boolean(form.id);

  const categoriesForType = useMemo(() => {
    if (form.type === "income") {
      return Array.from(
        new Set(
          [
            "Salary",
            "Refund",
            "Investment Income",
            "Other Income",
            form.category,
          ].filter(Boolean),
        ),
      );
    }
    return Array.from(
      new Set(
        [
          "Food",
          "Transport",
          "Housing",
          "Health",
          "Shopping",
          "Travel",
          "Entertainment",
          "Savings",
          "Other",
          form.category,
        ].filter(Boolean),
      ),
    );
  }, [form.type]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await api.get(
          `/api/transactions?month=${encodeURIComponent(month)}`,
        );
        setTransactions(res.data.transactions || []);
        setSummary(res.data.summary || null);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load transactions");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [month]);

  async function createFromPreview(preview) {
    setSubmitting(true);
    setError("");
    try {
      await api.post("/api/transactions", {
        amount: preview.amount,
        type: preview.type,
        category: preview.category,
        date: preview.date,
        recurringMonthly: Boolean(preview.recurringMonthly),
      });
      setNlpPreview(null);
      setOcrPreview(null);
      setNlpText("");
      setVoiceText("");
      setOcrText("");
      // Refresh
      const res = await api.get(
        `/api/transactions?month=${encodeURIComponent(month)}`,
      );
      setTransactions(res.data.transactions || []);
      setSummary(res.data.summary || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save transaction");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        amount: Number(form.amount),
        type: form.type,
        category: form.category,
        date: form.date,
        recurringMonthly: Boolean(form.recurringMonthly),
      };

      if (canEdit) {
        await api.put(`/api/transactions/${form.id}`, payload);
      } else {
        await api.post("/api/transactions", payload);
      }

      setForm({
        id: "",
        amount: "",
        type: "expense",
        category: "Food",
        date: month + "-01",
        recurringMonthly: false,
      });

      const res = await api.get(
        `/api/transactions?month=${encodeURIComponent(month)}`,
      );
      setTransactions(res.data.transactions || []);
      setSummary(res.data.summary || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to submit transaction");
    } finally {
      setSubmitting(false);
    }
  }

  async function onEdit(tx) {
    setForm({
      id: tx._id,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      date: String(tx.date).slice(0, 10),
      recurringMonthly: Boolean(tx.recurringMonthly),
    });
  }

  async function onDelete(id) {
    setSubmitting(true);
    setError("");
    try {
      await api.delete(`/api/transactions/${id}`);
      const res = await api.get(
        `/api/transactions?month=${encodeURIComponent(month)}`,
      );
      setTransactions(res.data.transactions || []);
      setSummary(res.data.summary || null);
      if (form.id === id) {
        setForm({
          id: "",
          amount: "",
          type: "expense",
          category: "Food",
          date: month + "-01",
          recurringMonthly: false,
        });
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete");
    } finally {
      setSubmitting(false);
    }
  }

  async function parseNLP(text) {
    if (!text || !text.trim()) return;
    setNlpLoading(true);
    setError("");
    try {
      const res = await api.post("/api/nlp/parse", { text });
      setNlpPreview(res.data.preview);
    } catch (err) {
      setError(err?.response?.data?.message || "NLP parse failed");
    } finally {
      setNlpLoading(false);
    }
  }

  function startVoice() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("SpeechRecognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setVoiceListening(true);
    setError("");
    recognition.onresult = async (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setVoiceText(transcript);
      setVoiceListening(false);
      await parseNLP(transcript);
    };

    recognition.onerror = () => {
      setVoiceListening(false);
      setError("Voice recognition failed.");
    };

    recognition.start();
  }

  async function handleOCRFile(file) {
    if (!file) return;
    setOcrBusy(true);
    setOcrPreview(null);
    setOcrText("");
    setError("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await api.post("/api/ocr/parse", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setOcrPreview(res.data.preview);
      setOcrText(res.data.extractedText || "");
    } catch (err) {
      setError(err?.response?.data?.message || "OCR parse failed");
    } finally {
      setOcrBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: 14 }}>
        <div>
          <div className="section-title" style={{ marginTop: 0 }}>
            Transactions
          </div>
          <div className="muted" style={{ fontWeight: 800 }}>
            Auto-calculated totals and AI-assisted input
          </div>
        </div>

        <div style={{ minWidth: 180 }}>
          <label>Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>

      {summary ? (
        <div className="grid grid-3">
          <div className="card">
            <h3>Total Income</h3>
            <div className="big">{formatCurrency(summary.totalIncome)}</div>
          </div>
          <div className="card">
            <h3>Total Expenses</h3>
            <div className="big" style={{ color: "var(--danger)" }}>
              {formatCurrency(summary.totalExpenses)}
            </div>
          </div>
          <div className="card">
            <h3>Savings</h3>
            <div
              className="big"
              style={{
                color:
                  summary.savings >= 0 ? "var(--success)" : "var(--danger)",
              }}
            >
              {formatCurrency(summary.savings)}
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          className="card"
          style={{ marginTop: 16, borderColor: "rgba(239,68,68,0.3)" }}
        >
          <div style={{ color: "var(--danger)", fontWeight: 900 }}>{error}</div>
        </div>
      ) : null}

      <div
        className="grid"
        style={{ gridTemplateColumns: "1.05fr 0.95fr", marginTop: 16 }}
      >
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>
            Add / Edit Transaction
          </div>
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <div>
              <label>Type</label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value,
                    category: categoriesForType[0],
                  })
                }
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <label>Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div>
                <label>Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {categoriesForType.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <label
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                marginBottom: 0,
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(form.recurringMonthly)}
                onChange={(e) =>
                  setForm({ ...form, recurringMonthly: e.target.checked })
                }
              />
              Recurring monthly
            </label>

            <div
              className="row"
              style={{ justifyContent: "flex-start", gap: 12 }}
            >
              <button className="primary" type="submit" disabled={submitting}>
                {submitting
                  ? "Saving..."
                  : canEdit
                    ? "Update"
                    : "Add Transaction"}
              </button>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      id: "",
                      amount: "",
                      type: "expense",
                      category: "Food",
                      date: month + "-01",
                      recurringMonthly: false,
                    })
                  }
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>
            AI Inputs
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label>Natural Language</label>
              <textarea
                value={nlpText}
                onChange={(e) => setNlpText(e.target.value)}
                placeholder="e.g. Spent 200 on food today"
                rows={3}
              />
              <div
                className="row"
                style={{ justifyContent: "flex-start", marginTop: 10 }}
              >
                <button
                  type="button"
                  className="primary"
                  onClick={() => parseNLP(nlpText)}
                  disabled={nlpLoading}
                >
                  {nlpLoading ? "Parsing..." : "Parse text"}
                </button>
              </div>
            </div>

            <div>
              <label>Voice Input</label>
              <div className="row" style={{ justifyContent: "flex-start" }}>
                <button
                  type="button"
                  className="primary"
                  onClick={startVoice}
                  disabled={voiceListening}
                  style={{ marginRight: 10 }}
                >
                  {voiceListening ? "Listening..." : "Start microphone"}
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceText("")}
                  disabled={voiceListening}
                >
                  Clear
                </button>
              </div>
              <textarea
                value={voiceText}
                onChange={(e) => setVoiceText(e.target.value)}
                placeholder="Recognized speech will appear here"
                rows={2}
                style={{ marginTop: 10 }}
              />
            </div>

            <div>
              <label>OCR Bill Scanner</label>
              <input
                type="file"
                accept="image/*"
                disabled={ocrBusy}
                onChange={(e) => handleOCRFile(e.target.files?.[0])}
              />
              {ocrBusy ? (
                <div className="muted" style={{ marginTop: 10 }}>
                  Scanning...
                </div>
              ) : null}
              {ocrText ? (
                <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                  Extracted text: <br />
                  <span style={{ wordBreak: "break-word" }}>
                    {ocrText.slice(0, 200)}
                  </span>
                  {ocrText.length > 200 ? "..." : ""}
                </div>
              ) : null}
            </div>
          </div>

          {nlpPreview ? (
            <PreviewEditor
              preview={nlpPreview}
              onChange={setNlpPreview}
              onConfirm={() => createFromPreview(nlpPreview)}
              confirmLabel="Save NLP transaction"
            />
          ) : null}

          {ocrPreview ? (
            <PreviewEditor
              preview={ocrPreview}
              onChange={setOcrPreview}
              onConfirm={() => createFromPreview(ocrPreview)}
              confirmLabel="Save OCR transaction"
            />
          ) : null}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row">
          <div className="section-title" style={{ margin: 0 }}>
            Transaction List {loading ? "" : `(${transactions.length})`}
          </div>
        </div>
        {loading ? <div className="muted">Loading...</div> : null}
        {!loading && transactions.length === 0 ? (
          <div className="muted">No transactions for this month.</div>
        ) : null}

        {!loading && transactions.length ? (
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {transactions
              .slice()
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map((tx) => (
                <div
                  key={`${tx._id?.toString ? tx._id.toString() : tx._id}-${String(tx.date).slice(0, 10)}`}
                  className="row"
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 190 }}>
                    <div style={{ fontWeight: 900 }}>
                      {tx.category}{" "}
                      {tx.recurringMonthly ? (
                        <span
                          className="muted"
                          style={{ fontWeight: 800, fontSize: 12 }}
                        >
                          (recurring)
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="muted"
                      style={{ fontSize: 12, fontWeight: 800 }}
                    >
                      {String(tx.date).slice(0, 10)}
                    </div>
                  </div>
                  <div
                    style={{
                      fontWeight: 900,
                      color:
                        tx.type === "income"
                          ? "var(--success)"
                          : "var(--danger)",
                      minWidth: 140,
                    }}
                  >
                    {tx.type === "income" ? "+" : "-"}
                    {formatCurrency(tx.amount)}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => onEdit(tx)}
                      disabled={submitting}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => onDelete(tx._id)}
                      disabled={submitting}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
