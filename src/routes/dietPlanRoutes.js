const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  generateDietPlanHandler,
  getCurrentDietPlan,
  getDietPlanHistory,
  regenerateDietPlan,
} = require("../controllers/dietPlanController");

router.get("/diet", authMiddleware, getCurrentDietPlan);
router.post("/diet", authMiddleware, generateDietPlanHandler);
router.get("/diet/history", authMiddleware, getDietPlanHistory);
router.post("/diet/regenerate", authMiddleware, regenerateDietPlan);

module.exports = router;
