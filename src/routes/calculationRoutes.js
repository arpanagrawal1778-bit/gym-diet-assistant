const express = require("express");
const router = express.Router();
const { getCurrentTarget, getHistory } = require("../controllers/calculationController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/current", authMiddleware, getCurrentTarget);
router.get("/history", authMiddleware, getHistory);

module.exports = router;
