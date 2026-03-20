const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { summary } = require("../controllers/analyticsController");

const router = express.Router();
router.use(authMiddleware);

router.get("/summary", summary);

module.exports = router;

