const { getDb } = require("../config/database");
const {
  reminderPreferencesSchema,
  formatZodError,
} = require("../validators");


/* =========================================================
   DEFAULT PREFERENCES
========================================================= */

const DEFAULT_PREFERENCES = Object.freeze({
  meal_reminders: true,
  workout_reminders: true,
  weight_checkin_day: "Mon",
  progress_photo_frequency: "weekly",
  plan_expiry_warning_days: 2,
  reminder_time: "08:00",
});


/* =========================================================
   GET REMINDER PREFERENCES
   GET /api/reminders/preferences
========================================================= */

async function getPreferences(req, res, next) {
  try {
    const userId = req.user.id;
    const db = getDb();

    const profile = db
      .prepare(
        `
        SELECT
          meal_reminders,
          workout_reminders,
          weight_checkin_day,
          progress_photo_frequency,
          plan_expiry_warning_days,
          reminder_time
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

    const preferences = {
      meal_reminders:
        profile.meal_reminders === null ||
        profile.meal_reminders === undefined
          ? DEFAULT_PREFERENCES.meal_reminders
          : Boolean(profile.meal_reminders),

      workout_reminders:
        profile.workout_reminders === null ||
        profile.workout_reminders === undefined
          ? DEFAULT_PREFERENCES.workout_reminders
          : Boolean(profile.workout_reminders),

      weight_checkin_day:
        profile.weight_checkin_day ||
        DEFAULT_PREFERENCES.weight_checkin_day,

      progress_photo_frequency:
        profile.progress_photo_frequency ||
        DEFAULT_PREFERENCES.progress_photo_frequency,

      plan_expiry_warning_days:
        profile.plan_expiry_warning_days === null ||
        profile.plan_expiry_warning_days === undefined
          ? DEFAULT_PREFERENCES.plan_expiry_warning_days
          : Number(profile.plan_expiry_warning_days),

      reminder_time:
        profile.reminder_time ||
        DEFAULT_PREFERENCES.reminder_time,
    };

    return res.json({
      success: true,
      data: preferences,
    });
  } catch (err) {
    next(err);
  }
}


/* =========================================================
   UPDATE REMINDER PREFERENCES
   PUT /api/reminders/preferences
========================================================= */

async function updatePreferences(req, res, next) {
  try {
    const userId = req.user.id;
    const db = getDb();

    const validation =
      reminderPreferencesSchema.safeParse(
        req.body
      );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Invalid reminder preferences",
          fields:
            formatZodError(
              validation.error
            ),
        },
      });
    }

    const data = validation.data;

    const existingProfile = db
      .prepare(
        `
        SELECT user_id
        FROM profiles
        WHERE user_id = ?
        `
      )
      .get(userId);

    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        error: {
          code: "PROFILE_NOT_FOUND",
          message: "Profile not found",
        },
      });
    }

    const updateStatement = db.prepare(
      `
      UPDATE profiles
      SET
        meal_reminders = ?,
        workout_reminders = ?,
        weight_checkin_day = ?,
        progress_photo_frequency = ?,
        plan_expiry_warning_days = ?,
        reminder_time = ?
      WHERE user_id = ?
      `
    );

    updateStatement.run(
      data.meal_reminders ? 1 : 0,
      data.workout_reminders ? 1 : 0,
      data.weight_checkin_day,
      data.progress_photo_frequency,
      data.plan_expiry_warning_days,
      data.reminder_time,
      userId
    );

    return res.json({
      success: true,
      data: {
        meal_reminders:
          Boolean(data.meal_reminders),

        workout_reminders:
          Boolean(data.workout_reminders),

        weight_checkin_day:
          data.weight_checkin_day,

        progress_photo_frequency:
          data.progress_photo_frequency,

        plan_expiry_warning_days:
          data.plan_expiry_warning_days,

        reminder_time:
          data.reminder_time,
      },
      message:
        "Reminder preferences updated successfully",
    });
  } catch (err) {
    next(err);
  }
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getPreferences,
  updatePreferences,
};