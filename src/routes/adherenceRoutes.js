const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getWeekly, getSummary } = require("../controllers/adherenceController");

router.get("/weekly", authMiddleware, getWeekly);
router.get("/summary", authMiddleware, getSummary);

module.exports = router;
