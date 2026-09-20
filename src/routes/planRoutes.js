const express = require("express");
const router = express.Router();
const { generatePlaceholderPlan } = require("../services/placeholderPlanService");
const { getDb } = require("../config/database");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/plans/placeholder", authMiddleware, (req, res, next) => {
  try {
    const userId = req.user.id;
    const db = getDb();

    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { code: "PROFILE_NOT_FOUND", message: "Profile not found" },
      });
    }

    const latest = db.prepare(
      `SELECT * FROM calorie_macro_history 
       WHERE user_id = ? AND profile_id = ?
       ORDER BY effective_at DESC, id DESC
       LIMIT 1`
    ).get(userId, profile.id);

    if (!latest) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CALCULATION_NOT_AVAILABLE",
          message: "Calorie and macro target has not been calculated yet.",
        },
      });
    }

    const plan = generatePlaceholderPlan(
      latest.calorie_target,
      latest.protein_grams,
      latest.carbs_grams,
      latest.fat_grams,
      latest.fitness_goal
    );

    return res.json({
      success: true,
      data: plan,
      message: "Placeholder plan generated",
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
