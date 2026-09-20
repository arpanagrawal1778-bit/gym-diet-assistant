const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  generateGymPlanHandler,
  getCurrentGymPlan,
  getGymPlanHistory,
  regenerateGymPlan,
} = require("../controllers/gymPlanController");

router.get("/gym", authMiddleware, getCurrentGymPlan);
router.post("/gym", authMiddleware, generateGymPlanHandler);
router.get("/gym/history", authMiddleware, getGymPlanHistory);
router.post("/gym/regenerate", authMiddleware, regenerateGymPlan);

module.exports = router;
