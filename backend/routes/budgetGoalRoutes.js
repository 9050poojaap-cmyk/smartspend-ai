const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { get, updateGoal, upsertBudget, removeBudget } = require("../controllers/budgetGoalController");

const router = express.Router();
router.use(authMiddleware);

router.get("/", get);
router.put("/goal", updateGoal);
router.put("/budgets", upsertBudget);
router.delete("/budgets/:category", removeBudget);

module.exports = router;

