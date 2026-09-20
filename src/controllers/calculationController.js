const { getDb } = require("../config/database");
const { calculateAll } = require("../services/calculationService");
const { generatePlaceholderPlan } = require("../services/placeholderPlanService");
const {
  HISTORY_DEFAULT_DAYS,
  HISTORY_MAX_DAYS,
  HISTORY_MAX_LIMIT,
} = require("../constants/calculations");

function getCurrentTarget(req, res, next) {
  try {
    const userId = req.user.id;
    const db = getDb();

    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: "PROFILE_NOT_FOUND",
          message: "Profile not found",
        },
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

    return res.json({
      success: true,
      data: {
        bmr: latest.bmr,
        tdee: latest.tdee,
        calorie_target: latest.calorie_target,
        protein_grams: latest.protein_grams,
        carbs_grams: latest.carbs_grams,
        fat_grams: latest.fat_grams,
        fitness_goal: latest.fitness_goal,
        activity_level: latest.activity_level,
        effective_at: latest.effective_at,
      },
      message: "Current target retrieved successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const userId = req.user.id;
    const db = getDb();

    const profile = db.prepare("SELECT id FROM profiles WHERE user_id = ?").get(userId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: "PROFILE_NOT_FOUND",
          message: "Profile not found",
        },
      });
    }

    let days = parseInt(req.query.days, 10);
    if (isNaN(days) || days <= 0) {
      days = HISTORY_DEFAULT_DAYS;
    }
    if (days > HISTORY_MAX_DAYS) {
      days = HISTORY_MAX_DAYS;
    }

    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) {
      page = 1;
    }

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1) {
      limit = HISTORY_MAX_LIMIT;
    }
    if (limit > HISTORY_MAX_LIMIT) {
      limit = HISTORY_MAX_LIMIT;
    }

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const total = db.prepare(
      `SELECT COUNT(*) as count FROM calorie_macro_history 
       WHERE user_id = ? AND profile_id = ? AND effective_at >= ?`
    ).get(userId, profile.id, cutoffDate).count;

    const offset = (page - 1) * limit;

    const records = db.prepare(
      `SELECT * FROM calorie_macro_history 
       WHERE user_id = ? AND profile_id = ? AND effective_at >= ?
       ORDER BY effective_at DESC, id DESC
       LIMIT ? OFFSET ?`
    ).all(userId, profile.id, cutoffDate, limit, offset);

    const totalPages = Math.ceil(total / limit);

    return res.json({
      success: true,
      data: records.map((r) => ({
        id: r.id,
        bmr: r.bmr,
        tdee: r.tdee,
        calorie_target: r.calorie_target,
        protein_grams: r.protein_grams,
        carbs_grams: r.carbs_grams,
        fat_grams: r.fat_grams,
        fitness_goal: r.fitness_goal,
        activity_level: r.activity_level,
        weight: r.weight,
        trigger: r.trigger,
        effective_at: r.effective_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      message: "History retrieved successfully",
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCurrentTarget, getHistory };
