const { getDb } = require("../config/database");
const { calculateAll } = require("../services/calculationService");

const CALORIE_FIELDS = [
  "gender",
  "age",
  "height",
  "weight",
  "activity_level",
  "fitness_goal",
];

function calculateFlags(existingProfile, newData) {
  const fieldsTriggeringCalorieRecalc = CALORIE_FIELDS;

  const fieldsTriggeringDietRegen = [
    "allergies",
    "monthly_diet_budget",
    "weight",
    "age",
    "height",
    "activity_level",
    "fitness_goal",
    "diet_preference",
  ];

  const fieldsTriggeringGymRegen = [
    "injuries",
    "gym_experience_level",
    "gym_experience_note",
    "activity_level",
    "fitness_goal",
    "weight",
  ];

  const fieldsTriggeringScheduleRegen = [
    "college_start_time",
    "college_end_time",
    "college_days",
  ];

  const needsCalorieRecalc =
    fieldsTriggeringCalorieRecalc.some(
      (field) =>
        newData[field] !== undefined &&
        newData[field] !== existingProfile[field]
    );

  const needsDietRegen =
    fieldsTriggeringDietRegen.some(
      (field) =>
        newData[field] !== undefined &&
        newData[field] !== existingProfile[field]
    );

  const needsGymRegen =
    fieldsTriggeringGymRegen.some(
      (field) =>
        newData[field] !== undefined &&
        newData[field] !== existingProfile[field]
    );

  const needsScheduleRegen =
    fieldsTriggeringScheduleRegen.some(
      (field) =>
        newData[field] !== undefined &&
        newData[field] !== existingProfile[field]
    );

  return {
    needs_calorie_recalculation:
      needsCalorieRecalc ? 1 : 0,

    needs_diet_regeneration:
      needsDietRegen ? 1 : 0,

    needs_gym_regeneration:
      needsGymRegen ? 1 : 0,

    needs_schedule_regeneration:
      needsScheduleRegen ? 1 : 0,
  };
}

function determineTrigger(existingProfile, newData) {
  const changedCalorieFields =
    CALORIE_FIELDS.filter(
      (field) =>
        newData[field] !== undefined &&
        newData[field] !== existingProfile[field]
    );

  if (changedCalorieFields.length === 0) {
    return null;
  }

  if (changedCalorieFields.length === 1) {
    const field =
      changedCalorieFields[0];

    const triggers = {
      gender: "gender_updated",
      age: "age_updated",
      height: "height_updated",
      weight: "weight_updated",
      activity_level: "activity_level_changed",
      fitness_goal: "fitness_goal_changed",
    };

    return (
      triggers[field] ||
      "multiple_profile_fields_changed"
    );
  }

  return "multiple_profile_fields_changed";
}

function parseJsonArray(str) {
  try {
    return JSON.parse(str || "[]");
  } catch {
    return [];
  }
}

function enrichProfile(profile) {
  profile.college_days =
    parseJsonArray(
      profile.college_days
    );

  profile.allergies =
    parseJsonArray(
      profile.allergies
    );

  profile.injuries =
    parseJsonArray(
      profile.injuries
    );

  return profile;
}


/* =========================================================
   CREATE PROFILE
========================================================= */

async function createProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const data = req.validated;
    const db = getDb();

    const existing =
      db
        .prepare(
          "SELECT id FROM profiles WHERE user_id = ?"
        )
        .get(userId);

    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: "PROFILE_EXISTS",
          message:
            "Profile already exists. Use PUT to update.",
        },
      });
    }

    const nullProfile = {
      gender: null,
      age: null,
      height: null,
      weight: null,
      activity_level: null,
      fitness_goal: null,
      diet_preference: null,
      monthly_diet_budget: null,
      allergies: null,
      college_start_time: null,
      college_end_time: null,
      college_days: null,
      gym_experience_level: null,
      injuries: null,
      meal_reminders: 1,
      workout_reminders: 1,
    };

    const flags =
      calculateFlags(
        nullProfile,
        data
      );

    const stmt = db.prepare(`
      INSERT INTO profiles (
        user_id,
        gender,
        age,
        height,
        weight,
        activity_level,
        fitness_goal,
        diet_preference,
        target_body_description,
        monthly_diet_budget,
        college_start_time,
        college_end_time,
        college_days,
        allergies,
        injuries,
        gym_experience_level,
        gym_experience_note,
        meal_reminders,
        workout_reminders,
        needs_calorie_recalculation,
        needs_diet_regeneration,
        needs_gym_regeneration,
        needs_schedule_regeneration
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      userId,
      data.gender,
      data.age,
      data.height,
      data.weight,
      data.activity_level,
      data.fitness_goal,
      data.diet_preference,
      data.target_body_description || "",
      data.monthly_diet_budget,
      data.college_start_time || null,
      data.college_end_time || null,
      JSON.stringify(
        data.college_days || []
      ),
      JSON.stringify(
        data.allergies || []
      ),
      JSON.stringify(
        data.injuries || []
      ),
      data.gym_experience_level,
      data.gym_experience_note || "",
      data.meal_reminders !== false
        ? 1
        : 0,
      data.workout_reminders !== false
        ? 1
        : 0,
      flags.needs_calorie_recalculation,
      flags.needs_diet_regeneration,
      flags.needs_gym_regeneration,
      flags.needs_schedule_regeneration
    );

    const profileId =
      result.lastInsertRowid;

    let calculation = null;

    if (
      flags.needs_calorie_recalculation
    ) {
      try {
        const profileRow =
          db
            .prepare(
              "SELECT * FROM profiles WHERE id = ?"
            )
            .get(profileId);

        calculation =
          calculateAll(
            profileRow
          );

        const now =
          new Date().toISOString();

        db.prepare(`
          INSERT INTO calorie_macro_history (
            user_id,
            profile_id,
            bmr,
            tdee,
            calorie_target,
            protein_grams,
            carbs_grams,
            fat_grams,
            fitness_goal,
            activity_level,
            weight,
            trigger,
            effective_at,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          profileId,
          calculation.bmr,
          calculation.tdee,
          calculation.calorie_target,
          calculation.protein_grams,
          calculation.carbs_grams,
          calculation.fat_grams,
          calculation.fitness_goal,
          calculation.activity_level,
          profileRow.weight,
          "profile_created",
          now,
          now
        );

        db.prepare(
          "UPDATE profiles SET needs_calorie_recalculation = 0 WHERE id = ?"
        ).run(profileId);

      } catch (calcErr) {
        console.error(
          "Calculation failed during profile creation:",
          calcErr.message
        );
      }
    }

    const profile =
      db
        .prepare(
          "SELECT * FROM profiles WHERE id = ?"
        )
        .get(profileId);

    enrichProfile(profile);

    const responseData = {
      ...profile,
    };

    if (calculation) {
      responseData.calculation =
        calculation;
    }

    return res.status(201).json({
      success: true,
      data: responseData,
      message:
        "Profile created successfully",
    });

  } catch (err) {
    next(err);
  }
}


/* =========================================================
   GET PROFILE
========================================================= */

async function getProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const db = getDb();

    const profile =
      db
        .prepare(
          "SELECT * FROM profiles WHERE user_id = ?"
        )
        .get(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: "PROFILE_NOT_FOUND",
          message:
            "Profile not found",
        },
      });
    }

    enrichProfile(profile);

    return res.json({
      success: true,
      data: profile,
    });

  } catch (err) {
    next(err);
  }
}


/* =========================================================
   UPDATE PROFILE
========================================================= */

async function updateProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const data = req.validated;
    const db = getDb();

    const existingProfile =
      db
        .prepare(
          "SELECT * FROM profiles WHERE user_id = ?"
        )
        .get(userId);

    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        error: {
          code: "PROFILE_NOT_FOUND",
          message:
            "Profile not found",
        },
      });
    }

    const flags =
      calculateFlags(
        existingProfile,
        data
      );

    const trigger =
      determineTrigger(
        existingProfile,
        data
      );

    const updates = [];
    const values = [];

    const allowedFields = [
      "gender",
      "age",
      "height",
      "weight",
      "activity_level",
      "fitness_goal",
      "diet_preference",
      "target_body_description",
      "monthly_diet_budget",
      "college_start_time",
      "college_end_time",
      "college_days",
      "allergies",
      "injuries",
      "gym_experience_level",
      "gym_experience_note",
      "meal_reminders",
      "workout_reminders",
    ];

    for (
      const field of allowedFields
    ) {

      if (
        data[field] !== undefined
      ) {

        updates.push(
          `${field} = ?`
        );

        if (
          field === "college_days" ||
          field === "allergies" ||
          field === "injuries"
        ) {

          values.push(
            JSON.stringify(
              data[field] || []
            )
          );

        } else if (
          field === "meal_reminders" ||
          field === "workout_reminders"
        ) {

          values.push(
            data[field] !== false
              ? 1
              : 0
          );

        } else {

          values.push(
            data[field]
          );
        }
      }
    }

    updates.push(
      "needs_calorie_recalculation = ?"
    );

    values.push(
      flags.needs_calorie_recalculation
    );

    updates.push(
      "needs_diet_regeneration = ?"
    );

    values.push(
      flags.needs_diet_regeneration
    );

    updates.push(
      "needs_gym_regeneration = ?"
    );

    values.push(
      flags.needs_gym_regeneration
    );

    updates.push(
      "needs_schedule_regeneration = ?"
    );

    values.push(
      flags.needs_schedule_regeneration
    );

    updates.push(
      "updated_at = datetime('now')"
    );

    values.push(userId);

    db.prepare(
      `
        UPDATE profiles
        SET ${updates.join(", ")}
        WHERE user_id = ?
      `
    ).run(...values);

    let calculation = null;

    if (trigger) {
      try {
        const updatedProfile =
          db
            .prepare(
              "SELECT * FROM profiles WHERE user_id = ?"
            )
            .get(userId);

        calculation =
          calculateAll(
            updatedProfile
          );

        const now =
          new Date().toISOString();

        db.prepare(`
          INSERT INTO calorie_macro_history (
            user_id,
            profile_id,
            bmr,
            tdee,
            calorie_target,
            protein_grams,
            carbs_grams,
            fat_grams,
            fitness_goal,
            activity_level,
            weight,
            trigger,
            effective_at,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          updatedProfile.id,
          calculation.bmr,
          calculation.tdee,
          calculation.calorie_target,
          calculation.protein_grams,
          calculation.carbs_grams,
          calculation.fat_grams,
          calculation.fitness_goal,
          calculation.activity_level,
          updatedProfile.weight,
          trigger,
          now,
          now
        );

        db.prepare(
          "UPDATE profiles SET needs_calorie_recalculation = 0 WHERE id = ?"
        ).run(
          updatedProfile.id
        );

      } catch (calcErr) {
        console.error(
          "Calculation failed during profile update:",
          calcErr.message
        );
      }
    }

    const profile =
      db
        .prepare(
          "SELECT * FROM profiles WHERE user_id = ?"
        )
        .get(userId);

    enrichProfile(profile);

    const responseData = {
      ...profile,
    };

    if (calculation) {
      responseData.calculation =
        calculation;
    }

    return res.json({
      success: true,
      data: responseData,
      message:
        "Profile updated successfully",
    });

  } catch (err) {
    next(err);
  }
}


module.exports = {
  createProfile,
  getProfile,
  updateProfile,
  calculateFlags,
  determineTrigger,
};