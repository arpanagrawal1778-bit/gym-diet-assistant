const { getDb } = require("../config/database");
const { generateSchedule } = require("../services/scheduleService");

const HISTORY_MAX_LIMIT = 100;


/* =========================================================
   HELPERS
========================================================= */

function parseJsonOrNull(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}


function getLatestDietPlan(db, userId) {
  const record = db
    .prepare(
      `
      SELECT
        meals_json,
        generated_at,
        valid_until
      FROM diet_plans
      WHERE user_id = ?
      ORDER BY generated_at DESC, id DESC
      LIMIT 1
      `
    )
    .get(userId);

  if (!record) {
    return null;
  }

  const plan = parseJsonOrNull(record.meals_json);

  if (!plan) {
    return null;
  }

  return {
    ...plan,
    generated_at: record.generated_at,
    valid_until: record.valid_until,
  };
}


function getLatestGymPlan(db, userId) {
  const record = db
    .prepare(
      `
      SELECT
        workouts_json,
        generated_at,
        valid_until
      FROM gym_plans
      WHERE user_id = ?
      ORDER BY generated_at DESC, id DESC
      LIMIT 1
      `
    )
    .get(userId);

  if (!record) {
    return null;
  }

  const plan = parseJsonOrNull(record.workouts_json);

  if (!plan) {
    return null;
  }

  return {
    ...plan,
    generated_at: record.generated_at,
    valid_until: record.valid_until,
  };
}


/* =========================================================
   GENERATE NEW SCHEDULE
========================================================= */

async function generateNewSchedule(
  db,
  userId,
  profile,
  dietPlan,
  gymPlan
) {
  const scheduleData = generateSchedule(
    profile,
    dietPlan,
    gymPlan
  );

  if (!scheduleData) {
    throw new Error(
      "Schedule generation returned no data"
    );
  }

  const now =
    new Date().toISOString();

  const planJson =
    JSON.stringify(scheduleData);

  const insertResult = db
    .prepare(
      `
      INSERT INTO schedules (
        user_id,
        merged_schedule_json,
        generated_at
      )
      VALUES (?, ?, ?)
      `
    )
    .run(
      userId,
      planJson,
      now
    );

  db
    .prepare(
      `
      UPDATE profiles
      SET needs_schedule_regeneration = 0
      WHERE user_id = ?
      `
    )
    .run(userId);

  return {
    schedule: scheduleData,
    scheduleId:
      insertResult.lastInsertRowid,
    generatedAt: now,
  };
}


/* =========================================================
   GET CURRENT SCHEDULE
========================================================= */

async function getCurrentSchedule(
  req,
  res,
  next
) {
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
      profile.needs_schedule_regeneration === 1;


    const latestSchedule = db
      .prepare(
        `
        SELECT *
        FROM schedules
        WHERE user_id = ?
        ORDER BY generated_at DESC, id DESC
        LIMIT 1
        `
      )
      .get(userId);


    const dietPlan =
      getLatestDietPlan(
        db,
        userId
      );

    const gymPlan =
      getLatestGymPlan(
        db,
        userId
      );


    /*
     * Generate automatically when:
     * 1. There is no schedule yet
     * 2. The profile says it needs regeneration
     * 3. The stored schedule cannot be parsed
     */

    if (
      needsRegen ||
      !latestSchedule
    ) {
      const result =
        await generateNewSchedule(
          db,
          userId,
          profile,
          dietPlan,
          gymPlan
        );

      return res.json({
        success: true,
        data: result.schedule,
        message: "Schedule generated",
      });
    }


    const schedule =
      parseJsonOrNull(
        latestSchedule.merged_schedule_json
      );


    if (!schedule) {
      console.warn(
        "Stored schedule could not be parsed. Regenerating."
      );

      const result =
        await generateNewSchedule(
          db,
          userId,
          profile,
          dietPlan,
          gymPlan
        );

      return res.json({
        success: true,
        data: result.schedule,
        message:
          "Schedule regenerated after parse recovery",
      });
    }


    return res.json({
      success: true,
      data: schedule,
      message:
        "Current schedule retrieved successfully",
    });

  } catch (err) {
    next(err);
  }
}


/* =========================================================
   REGENERATE SCHEDULE
========================================================= */

async function regenerateSchedule(
  req,
  res,
  next
) {
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


    const dietPlan =
      getLatestDietPlan(
        db,
        userId
      );

    const gymPlan =
      getLatestGymPlan(
        db,
        userId
      );


    const result =
      await generateNewSchedule(
        db,
        userId,
        profile,
        dietPlan,
        gymPlan
      );


    return res.status(201).json({
      success: true,
      data: result.schedule,
      message:
        "Schedule regenerated successfully",
    });

  } catch (err) {
    next(err);
  }
}


/* =========================================================
   SCHEDULE HISTORY
========================================================= */

async function getScheduleHistory(
  req,
  res,
  next
) {
  try {
    const userId = req.user.id;
    const db = getDb();


    let page =
      parseInt(
        req.query.page,
        10
      );

    if (
      Number.isNaN(page) ||
      page < 1
    ) {
      page = 1;
    }


    let limit =
      parseInt(
        req.query.limit,
        10
      );

    if (
      Number.isNaN(limit) ||
      limit < 1
    ) {
      limit = HISTORY_MAX_LIMIT;
    }

    if (
      limit > HISTORY_MAX_LIMIT
    ) {
      limit = HISTORY_MAX_LIMIT;
    }


    const offset =
      (page - 1) * limit;


    const total =
      db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM schedules
          WHERE user_id = ?
          `
        )
        .get(userId).count;


    const records =
      db
        .prepare(
          `
          SELECT
            id,
            merged_schedule_json,
            generated_at
          FROM schedules
          WHERE user_id = ?
          ORDER BY generated_at DESC, id DESC
          LIMIT ? OFFSET ?
          `
        )
        .all(
          userId,
          limit,
          offset
        );


    const totalPages =
      Math.ceil(
        total / limit
      ) || 1;


    const schedules =
      records.map(
        (record) => {
          const schedule =
            parseJsonOrNull(
              record.merged_schedule_json
            );

          return {
            id: record.id,
            schedule:
              schedule ||
              {
                merged_schedule_json:
                  record.merged_schedule_json,
              },
            generated_at:
              record.generated_at,
          };
        }
      );


    return res.json({
      success: true,
      data: schedules,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      message:
        "Schedule history retrieved successfully",
    });

  } catch (err) {
    next(err);
  }
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getCurrentSchedule,
  regenerateSchedule,
  getScheduleHistory,
};