const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const transactionController = require("../controllers/transactionController");

const router = express.Router();

router.use(authMiddleware);

router.get("/", transactionController.list);
router.post("/", transactionController.create);
router.put("/:id", transactionController.update);
router.delete("/:id", transactionController.remove);

module.exports = router;

