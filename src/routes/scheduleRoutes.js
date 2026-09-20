const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getCurrentSchedule,
  regenerateSchedule,
  getScheduleHistory,
} = require("../controllers/scheduleController");

router.get("/schedule", authMiddleware, getCurrentSchedule);
router.post("/schedule/regenerate", authMiddleware, regenerateSchedule);
router.get("/schedule/history", authMiddleware, getScheduleHistory);

module.exports = router;
