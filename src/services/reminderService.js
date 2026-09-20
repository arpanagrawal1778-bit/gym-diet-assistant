const fs = require("fs");
const path = require("path");

const { getDb } = require("../config/database");
const emailService = require("./emailService");


/* =========================================================
   EMAIL TEMPLATE LOADER
========================================================= */

function loadTemplate(name) {
  const filePath = path.join(
    __dirname,
    "..",
    "templates",
    "emails",
    `${name}.html`
  );

  try {
    return fs.readFileSync(
      filePath,
      "utf-8"
    );
  } catch (err) {
    console.warn(
      `Reminder email template not found: ${name}`
    );

    return `<p>${name} reminder</p>`;
  }
}


/* =========================================================
   REMINDER DEFINITIONS
========================================================= */

const REMINDER_DEFINITIONS =
  Object.freeze({
    meal: {
      template: "mealReminder",
      subject: "Meal Reminder",
    },

    workout: {
      template: "workoutReminder",
      subject: "Workout Reminder",
    },

    weight_checkin: {
      template: "weightCheckin",
      subject:
        "Weight Check-in Reminder",
    },

    progress_photo: {
      template: "progressPhoto",
      subject:
        "Progress Photo Reminder",
    },

    plan_expiry: {
      template: "planExpiry",
      subject:
        "Plan Expiry Reminder",
    },

    test: {
      template: "test",
      subject: "Test Email",
    },
  });


/* =========================================================
   DEFAULT PREFERENCES
========================================================= */

const DEFAULT_PREFERENCES =
  Object.freeze({
    meal_reminders: true,
    workout_reminders: true,
    weight_checkin_day: "Mon",
    progress_photo_frequency:
      "weekly",
    plan_expiry_warning_days: 2,
    reminder_time: "08:00",
  });


/* =========================================================
   GET USER REMINDER PREFERENCES
========================================================= */

function getReminderPreferences(
  db,
  userId
) {
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
    return null;
  }

  return {
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
      profile.plan_expiry_warning_days ===
        null ||
      profile.plan_expiry_warning_days ===
        undefined
        ? DEFAULT_PREFERENCES.plan_expiry_warning_days
        : Number(
            profile.plan_expiry_warning_days
          ),

    reminder_time:
      profile.reminder_time ||
      DEFAULT_PREFERENCES.reminder_time,
  };
}


/* =========================================================
   DUPLICATE CHECK
========================================================= */

function getTodayDate() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function wasSentToday(
  db,
  userId,
  type
) {
  const today =
    getTodayDate();

  const row = db
    .prepare(
      `
      SELECT 1
      FROM reminder_logs
      WHERE
        user_id = ?
        AND reminder_type = ?
        AND DATE(sent_at) = ?
        AND status = 'sent'
      LIMIT 1
      `
    )
    .get(
      userId,
      type,
      today
    );

  return Boolean(row);
}


/* =========================================================
   LOG REMINDER
========================================================= */

function logReminder(
  db,
  userId,
  type,
  status,
  errorMessage = null
) {
  db
    .prepare(
      `
      INSERT INTO reminder_logs (
        user_id,
        reminder_type,
        sent_at,
        status
      )
      VALUES (?, ?, datetime('now'), ?)
      `
    )
    .run(
      userId,
      type,
      status
    );

  return errorMessage;
}


/* =========================================================
   SEND REMINDER
========================================================= */

async function sendReminder(
  userId,
  toEmail,
  type,
  options = {}
) {
  const db = getDb();

  if (!toEmail) {
    return {
      sent: false,
      error: "NO_EMAIL",
    };
  }


  const definition =
    REMINDER_DEFINITIONS[type];

  if (!definition) {
    return {
      sent: false,
      error: "UNKNOWN_TYPE",
    };
  }


  /*
   * Test emails should always be sendable.
   * Normal reminders are protected from duplicates.
   */
  const bypassDuplicateCheck =
    Boolean(
      options.bypassDuplicateCheck
    );


  if (
    !bypassDuplicateCheck &&
    wasSentToday(
      db,
      userId,
      type
    )
  ) {
    return {
      sent: false,
      skipped: true,
      reason:
        "ALREADY_SENT_TODAY",
    };
  }


  const html =
    loadTemplate(
      definition.template
    );


  try {
    const result =
      await emailService.sendMail(
        toEmail,
        definition.subject,
        html,
        undefined
      );


    if (result.success) {
      logReminder(
        db,
        userId,
        type,
        "sent"
      );

      return {
        sent: true,
      };
    }


    logReminder(
      db,
      userId,
      type,
      "failed"
    );


    return {
      sent: false,
      error:
        result.error ||
        "SEND_FAILED",
    };

  } catch (error) {
    logReminder(
      db,
      userId,
      type,
      "failed"
    );

    return {
      sent: false,
      error:
        error.message ||
        "SEND_FAILED",
    };
  }
}


/* =========================================================
   SEND TEST EMAIL
========================================================= */

async function sendTestEmail(
  userId,
  toEmail
) {
  return sendReminder(
    userId,
    toEmail,
    "test",
    {
      bypassDuplicateCheck: true,
    }
  );
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  sendReminder,
  sendTestEmail,
  getReminderPreferences,

  _private: {
    loadTemplate,
    getTodayDate,
    wasSentToday,
    logReminder,
    REMINDER_DEFINITIONS,
    DEFAULT_PREFERENCES,
  },
};