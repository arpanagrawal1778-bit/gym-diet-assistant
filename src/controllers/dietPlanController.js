const { getDb } = require("../config/database");
const { calculateAll } = require("../services/calculationService");
const { generateDietPlan } = require("../services/dietPlanService");
const env = require("../config/env");

const HISTORY_MAX_LIMIT = 100;

async function generateNewDietPlan(db, userId, profile, calculation) {
  const result = await generateDietPlan(profile, calculation);
  const plan = result.plan;

  const now = new Date().toISOString();
  const validUntil = new Date(Date.now() + env.planValidityDays * 24 * 60 * 60 * 1000).toISOString();

  const planJson = JSON.stringify(plan);

  const insertResult = db.prepare(
    `INSERT INTO diet_plans (user_id, meals_json, generated_at, valid_until) VALUES (?, ?, ?, ?)`
  ).run(userId, planJson, now, validUntil);

  if (result.source === "llm" || result.source === "rule_based") {
    db.prepare("UPDATE profiles SET needs_diet_regeneration = 0 WHERE user_id = ?").run(userId);
  }

  return {
    plan,
    planId: insertResult.lastInsertRowid,
    validUntil,
    source: result.source,
    validationErrors: result.validationErrors,
    generationError: result.error,
  };
}

async function generateDietPlanHandler(req, res, next) {
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

    const calculation = {
      bmr: latest.bmr,
      tdee: latest.tdee,
      calorie_target: latest.calorie_target,
      protein_grams: latest.protein_grams,
      carbs_grams: latest.carbs_grams,
      fat_grams: latest.fat_grams,
      fitness_goal: latest.fitness_goal || profile.fitness_goal,
      activity_level: latest.activity_level || profile.activity_level,
      weight: latest.weight || profile.weight,
    };

    const result = await generateNewDietPlan(db, userId, profile, calculation);

    return res.status(201).json({
      success: true,
      data: result.plan,
      message: "Diet plan generated successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function getCurrentDietPlan(req, res, next) {
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

    const needsRegen = profile.needs_diet_regeneration === 1;
    const now = new Date().toISOString();

    const latestPlan = db.prepare(
      `SELECT * FROM diet_plans
       WHERE user_id = ?
       ORDER BY generated_at DESC, id DESC
       LIMIT 1`
    ).get(userId);

    const planExpired = !latestPlan || (latestPlan.valid_until && latestPlan.valid_until < now);

    if (needsRegen || planExpired) {
      const calculation = {
        bmr: latest.bmr,
        tdee: latest.tdee,
        calorie_target: latest.calorie_target,
        protein_grams: latest.protein_grams,
        carbs_grams: latest.carbs_grams,
        fat_grams: latest.fat_grams,
        fitness_goal: latest.fitness_goal || profile.fitness_goal,
        activity_level: latest.activity_level || profile.activity_level,
        weight: latest.weight || profile.weight,
      };

      const result = await generateNewDietPlan(db, userId, profile, calculation);

      return res.json({
        success: true,
        data: result.plan,
        message: "Diet plan generated",
      });
    }

    if (!latestPlan) {
      return res.status(404).json({
        success: false,
        error: { code: "DIET_PLAN_NOT_FOUND", message: "No diet plan available. Generate one first." },
      });
    }

    let plan;
    try {
      plan = JSON.parse(latestPlan.meals_json);
    } catch (parseErr) {
      console.error("Failed to parse stored diet plan:", parseErr.message);
      return res.status(500).json({
        success: false,
        error: { code: "PARSE_ERROR", message: "Failed to parse stored diet plan" },
      });
    }

    db.prepare("UPDATE profiles SET needs_diet_regeneration = 0 WHERE user_id = ?").run(userId);

    return res.json({
      success: true,
      data: plan,
      message: "Current diet plan retrieved successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function getDietPlanHistory(req, res, next) {
  try {
    const userId = req.user.id;
    const db = getDb();

    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1) limit = HISTORY_MAX_LIMIT;
    if (limit > HISTORY_MAX_LIMIT) limit = HISTORY_MAX_LIMIT;

    const offset = (page - 1) * limit;

    const total = db.prepare(
      "SELECT COUNT(*) as count FROM diet_plans WHERE user_id = ?"
    ).get(userId).count;

    const records = db.prepare(
      `SELECT id, meals_json, generated_at, valid_until FROM diet_plans
       WHERE user_id = ?
       ORDER BY generated_at DESC, id DESC
       LIMIT ? OFFSET ?`
    ).all(userId, limit, offset);

    const totalPages = Math.ceil(total / limit) || 1;

    const plans = records.map((r) => {
      let plan = null;
      try {
        plan = JSON.parse(r.meals_json);
      } catch {
        plan = { meals_json: r.meals_json };
      }
      return {
        id: r.id,
        plan,
        generated_at: r.generated_at,
        valid_until: r.valid_until,
      };
    });

    return res.json({
      success: true,
      data: plans,
      pagination: { page, limit, total, totalPages },
      message: "Diet plan history retrieved successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function regenerateDietPlan(req, res, next) {
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

    const calculation = {
      bmr: latest.bmr,
      tdee: latest.tdee,
      calorie_target: latest.calorie_target,
      protein_grams: latest.protein_grams,
      carbs_grams: latest.carbs_grams,
      fat_grams: latest.fat_grams,
      fitness_goal: latest.fitness_goal || profile.fitness_goal,
      activity_level: latest.activity_level || profile.activity_level,
      weight: latest.weight || profile.weight,
    };

    const result = await generateNewDietPlan(db, userId, profile, calculation);

    return res.status(201).json({
      success: true,
      data: result.plan,
      message: "Diet plan regenerated successfully",
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  generateDietPlanHandler,
  getCurrentDietPlan,
  getDietPlanHistory,
  regenerateDietPlan,
};
