const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, required: true, enum: ["income", "expense"] },
    category: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },

    // Recurring monthly transactions (stored as a "template" occurrence date).
    recurringMonthly: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);

