const express = require("express");
const { parse } = require("../controllers/nlpController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);
router.post("/parse", parse);

module.exports = router;

