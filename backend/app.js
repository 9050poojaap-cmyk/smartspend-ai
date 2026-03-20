const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const nlpRoutes = require("./routes/nlpRoutes");
const ocrRoutes = require("./routes/ocrRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const budgetGoalRoutes = require("./routes/budgetGoalRoutes");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "*",
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
  })
);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/nlp", nlpRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/budget-goals", budgetGoalRoutes);

// Basic 404 handler
app.use((req, res) => {
  return res.status(404).json({ message: "Endpoint not found" });
});

// Error handler (keep it last)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  return res.status(status).json({
    message: err.message || "Server error",
  });
});

module.exports = app;

