const { getDb } = require("../config/database");
const { generateGymPlan } = require("../services/gymPlanService");
const env = require("../config/env");

const HISTORY_MAX_LIMIT = 100;

async function generateNewGymPlan(db, userId, profile, calculation) {
  const result = await generateGymPlan(profile, calculation);
  const plan = result.plan;

  const now = new Date().toISOString();

  const validUntil = new Date(
    Date.now() + env.planValidityDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const planJson = JSON.stringify(plan);

  const insertResult = db
    .prepare(
      `
      INSERT INTO gym_plans (
        user_id,
        workouts_json,
        generated_at,
        valid_until
      )
      VALUES (?, ?, ?, ?)
      `
    )
    .run(
      userId,
      planJson,
      now,
      validUntil
    );

  // A successful generation satisfies the regeneration requirement,
  // regardless of whether the source was AI or rule-based.
  db
    .prepare(
      `
      UPDATE profiles
      SET needs_gym_regeneration = 0
      WHERE user_id = ?
      `
    )
    .run(userId);

  return {
    plan,
    planId: insertResult.lastInsertRowid,
    validUntil,
    source: result.source,
    validationErrors: result.validationErrors,
    generationError: result.error,
  };
}

async function generateGymPlanHandler(req, res, next) {
  try {
    const userId = req.user.id;
    const db = getDb();

    const profile = db
      .prepare(
        `
        SELECT *
        FROM profiles
        WHERE user_id = ?
        `
      )
      .get(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: "PROFILE_NOT_FOUND",
          message: "Profile not found",
        },
      });
    }

    const calculation = {
      fitness_goal: profile.fitness_goal,
      activity_level: profile.activity_level,
      weight: profile.weight,
    };

    const result = await generateNewGymPlan(
      db,
      userId,
      profile,
      calculation
    );

    return res.status(201).json({
      success: true,
      data: result.plan,
      message: "Gym plan generated successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function getCurrentGymPlan(req, res, next) {
  try {
    const userId = req.user.id;
    const db = getDb();

    const profile = db
      .prepare(
        `
        SELECT *
        FROM profiles
        WHERE user_id = ?
        `
      )
      .get(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: "PROFILE_NOT_FOUND",
          message: "Profile not found",
        },
      });
    }

    const needsRegen =
      profile.needs_gym_regeneration === 1;

    const now = new Date().toISOString();

    const latestPlan = db
      .prepare(
        `
        SELECT *
        FROM gym_plans
        WHERE user_id = ?
        ORDER BY generated_at DESC, id DESC
        LIMIT 1
        `
      )
      .get(userId);

    const planExpired =
      !latestPlan ||
      (
        latestPlan.valid_until &&
        latestPlan.valid_until < now
      );

    if (needsRegen || planExpired) {
      const calculation = {
        fitness_goal: profile.fitness_goal,
        activity_level: profile.activity_level,
        weight: profile.weight,
      };

      const result = await generateNewGymPlan(
        db,
        userId,
        profile,
        calculation
      );

      return res.json({
        success: true,
        data: result.plan,
        message: "Gym plan generated",
      });
    }

    if (!latestPlan) {
      return res.status(404).json({
        success: false,
        error: {
          code: "GYM_PLAN_NOT_FOUND",
          message:
            "No gym plan available. Generate one first.",
        },
      });
    }

    let plan;

    try {
      plan = JSON.parse(
        latestPlan.workouts_json
      );
    } catch (parseErr) {
      console.error(
        "Failed to parse stored gym plan:",
        parseErr.message
      );

      return res.status(500).json({
        success: false,
        error: {
          code: "PARSE_ERROR",
          message: "Failed to parse stored gym plan",
        },
      });
    }

    return res.json({
      success: true,
      data: plan,
      message:
        "Current gym plan retrieved successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function getGymPlanHistory(req, res, next) {
  try {
    const userId = req.user.id;
    const db = getDb();

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

    const offset = (page - 1) * limit;

    const total = db
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM gym_plans
        WHERE user_id = ?
        `
      )
      .get(userId).count;

    const records = db
      .prepare(
        `
        SELECT
          id,
          workouts_json,
          generated_at,
          valid_until
        FROM gym_plans
        WHERE user_id = ?
        ORDER BY generated_at DESC, id DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(userId, limit, offset);

    const totalPages =
      Math.ceil(total / limit) || 1;

    const plans = records.map((record) => {
      let plan = null;

      try {
        plan = JSON.parse(
          record.workouts_json
        );
      } catch {
        plan = {
          workouts_json:
            record.workouts_json,
        };
      }

      return {
        id: record.id,
        plan,
        generated_at:
          record.generated_at,
        valid_until:
          record.valid_until,
      };
    });

    return res.json({
      success: true,
      data: plans,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      message:
        "Gym plan history retrieved successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function regenerateGymPlan(req, res, next) {
  try {
    const userId = req.user.id;
    const db = getDb();

    const profile = db
      .prepare(
        `
        SELECT *
        FROM profiles
        WHERE user_id = ?
        `
      )
      .get(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: "PROFILE_NOT_FOUND",
          message: "Profile not found",
        },
      });
    }

    const calculation = {
      fitness_goal: profile.fitness_goal,
      activity_level: profile.activity_level,
      weight: profile.weight,
    };

    const result = await generateNewGymPlan(
      db,
      userId,
      profile,
      calculation
    );

    return res.status(201).json({
      success: true,
      data: result.plan,
      message:
        "Gym plan regenerated successfully",
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  generateGymPlanHandler,
  getCurrentGymPlan,
  getGymPlanHistory,
  regenerateGymPlan,
};