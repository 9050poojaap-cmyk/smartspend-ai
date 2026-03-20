const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const { parse } = require("../controllers/ocrController");

const router = express.Router();
router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.post("/parse", upload.single("image"), parse);

module.exports = router;

