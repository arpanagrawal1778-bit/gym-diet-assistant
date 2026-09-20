const cron = require("node-cron");

const { getDb } = require("../config/database");
const reminderService = require("./reminderService");
const env = require("../config/env");

let jobs = [];
let started = false;


/* =========================================================
   CONFIGURATION
========================================================= */

const DEFAULT_REMINDER_TIME = "08:00";
const DEFAULT_WARNING_DAYS = 2;

// India is the primary timezone for this college-focused app.
// If env.timezone is added later, it can override this.
const SCHEDULER_TIMEZONE =
  env.timezone ||
  "Asia/Kolkata";


/* =========================================================
   HELPERS
========================================================= */

function parseTime(value) {
  if (!value) {
    return null;
  }

  const match = String(value)
    .trim()
    .match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!match) {
    return null;
  }

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
  };
}


function getCurrentTimeParts() {
  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          SCHEDULER_TIMEZONE,

        hour: "2-digit",
        minute: "2-digit",
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",

        hourCycle: "h23",
      }
    );

  const parts =
    formatter
      .formatToParts(
        new Date()
      )
      .reduce(
        (result, part) => {
          if (part.type !== "literal") {
            result[part.type] =
              part.value;
          }

          return result;
        },
        {}
      );

  return {
    hours: Number(
      parts.hour
    ),

    minutes: Number(
      parts.minute
    ),

    weekday:
      parts.weekday,

    day: Number(
      parts.day
    ),

    month: Number(
      parts.month
    ),

    year: Number(
      parts.year
    ),
  };
}


function getDayCode() {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          SCHEDULER_TIMEZONE,

        weekday: "short",
      }
    );

  return formatter
    .format(new Date());
}


function normalizeDay(value) {
  if (!value) {
    return "";
  }

  const day =
    String(value)
      .trim()
      .toLowerCase();

  const map = {
    mon: "Mon",
    monday: "Mon",

    tue: "Tue",
    tues: "Tue",
    tuesday: "Tue",

    wed: "Wed",
    wednesday: "Wed",

    thu: "Thu",
    thurs: "Thu",
    thursday: "Thu",

    fri: "Fri",
    friday: "Fri",

    sat: "Sat",
    saturday: "Sat",

    sun: "Sun",
    sunday: "Sun",
  };

  return (
    map[day] ||
    value
  );
}


function isReminderTime(
  configuredTime,
  currentTime
) {
  const parsed =
    parseTime(
      configuredTime ||
      DEFAULT_REMINDER_TIME
    );

  if (!parsed) {
    return false;
  }

  return (
    parsed.hours ===
      currentTime.hours &&
    parsed.minutes ===
      currentTime.minutes
  );
}


function getAllUsers() {
  const db = getDb();

  return db
    .prepare(
      `
      SELECT
        u.id,
        u.email,

        p.meal_reminders,
        p.workout_reminders,
        p.weight_checkin_day,
        p.progress_photo_frequency,
        p.plan_expiry_warning_days,
        p.reminder_time

      FROM users u

      INNER JOIN profiles p
        ON u.id = p.user_id

      WHERE u.email IS NOT NULL
      `
    )
    .all();
}


function shouldSendBiweekly(
  currentTime
) {
  // Week number based on the current year.
  // Alternates every other week.
  const date = new Date(
    Date.UTC(
      currentTime.year,
      currentTime.month - 1,
      currentTime.day
    )
  );

  const startOfYear =
    new Date(
      Date.UTC(
        currentTime.year,
        0,
        1
      )
    );

  const dayDifference =
    Math.floor(
      (
        date -
        startOfYear
      ) /
      (24 * 60 * 60 * 1000)
    );

  const weekNumber =
    Math.floor(
      dayDifference / 7
    ) + 1;

  return weekNumber % 2 === 0;
}


/* =========================================================
   MEAL REMINDERS
========================================================= */

async function processMealReminders(
  users,
  currentTime
) {
  for (const user of users) {
    if (
      !Boolean(
        user.meal_reminders
      )
    ) {
      continue;
    }

    const reminderTime =
      user.reminder_time ||
      DEFAULT_REMINDER_TIME;

    if (
      !isReminderTime(
        reminderTime,
        currentTime
      )
    ) {
      continue;
    }

    await reminderService.sendReminder(
      user.id,
      user.email,
      "meal"
    );
  }
}


/* =========================================================
   WORKOUT REMINDERS
========================================================= */

async function processWorkoutReminders(
  users,
  currentTime
) {
  for (const user of users) {
    if (
      !Boolean(
        user.workout_reminders
      )
    ) {
      continue;
    }

    const reminderTime =
      user.reminder_time ||
      DEFAULT_REMINDER_TIME;

    if (
      !isReminderTime(
        reminderTime,
        currentTime
      )
    ) {
      continue;
    }

    await reminderService.sendReminder(
      user.id,
      user.email,
      "workout"
    );
  }
}


/* =========================================================
   WEIGHT CHECK-IN REMINDERS
========================================================= */

async function processWeightCheckins(
  users,
  currentTime
) {
  const today =
    normalizeDay(
      getDayCode()
    );

  for (const user of users) {
    const configuredDay =
      normalizeDay(
        user.weight_checkin_day
      );

    if (
      configuredDay !==
      today
    ) {
      continue;
    }

    const reminderTime =
      user.reminder_time ||
      DEFAULT_REMINDER_TIME;

    if (
      !isReminderTime(
        reminderTime,
        currentTime
      )
    ) {
      continue;
    }

    await reminderService.sendReminder(
      user.id,
      user.email,
      "weight_checkin"
    );
  }
}


/* =========================================================
   PROGRESS PHOTO REMINDERS
========================================================= */

async function processProgressPhotoReminders(
  users,
  currentTime
) {
  const today =
    normalizeDay(
      getDayCode()
    );

  for (const user of users) {
    const frequency =
      user.progress_photo_frequency ||
      "weekly";

    const reminderTime =
      user.reminder_time ||
      DEFAULT_REMINDER_TIME;

    if (
      !isReminderTime(
        reminderTime,
        currentTime
      )
    ) {
      continue;
    }


    let shouldSend = false;


    /*
     * Weekly:
     * Send on the user's configured
     * weight check-in day.
     */

    if (
      frequency ===
      "weekly"
    ) {
      shouldSend =
        normalizeDay(
          user.weight_checkin_day
        ) === today;
    }


    /*
     * Biweekly:
     * Send on the configured day
     * every second week.
     */

    else if (
      frequency ===
      "biweekly"
    ) {
      shouldSend =
        normalizeDay(
          user.weight_checkin_day
        ) === today &&
        shouldSendBiweekly(
          currentTime
        );
    }


    /*
     * Monthly:
     * Send on the first day of the month.
     */

    else if (
      frequency ===
      "monthly"
    ) {
      shouldSend =
        currentTime.day === 1;
    }


    if (!shouldSend) {
      continue;
    }


    await reminderService.sendReminder(
      user.id,
      user.email,
      "progress_photo"
    );
  }
}


/* =========================================================
   PLAN EXPIRY REMINDERS
========================================================= */

async function processPlanExpiryReminders(
  users,
  currentTime
) {
  const db =
    getDb();

  const now =
    new Date();


  for (const user of users) {
    const warningDays =
      Number(
        user.plan_expiry_warning_days
      );

    const warnDays =
      Number.isFinite(
        warningDays
      )
        ? warningDays
        : DEFAULT_WARNING_DAYS;


    const reminderTime =
      user.reminder_time ||
      DEFAULT_REMINDER_TIME;


    if (
      !isReminderTime(
        reminderTime,
        currentTime
      )
    ) {
      continue;
    }


    /*
     * Latest diet plan
     */

    const dietPlan =
      db
        .prepare(
          `
          SELECT
            valid_until
          FROM diet_plans
          WHERE user_id = ?
            AND valid_until IS NOT NULL
          ORDER BY generated_at DESC, id DESC
          LIMIT 1
          `
        )
        .get(
          user.id
        );


    /*
     * Latest gym plan
     */

    const gymPlan =
      db
        .prepare(
          `
          SELECT
            valid_until
          FROM gym_plans
          WHERE user_id = ?
            AND valid_until IS NOT NULL
          ORDER BY generated_at DESC, id DESC
          LIMIT 1
          `
        )
        .get(
          user.id
        );


    const plans = [
      dietPlan,
      gymPlan,
    ].filter(Boolean);


    let shouldSend = false;


    for (const plan of plans) {
      const expiryDate =
        new Date(
          plan.valid_until
        );

      if (
        Number.isNaN(
          expiryDate.getTime()
        )
      ) {
        continue;
      }


      const diffMs =
        expiryDate -
        now;

      const diffDays =
        Math.ceil(
          diffMs /
          (
            1000 *
            60 *
            60 *
            24
          )
        );


      if (
        diffDays <=
          warnDays &&
        diffDays >= 0
      ) {
        shouldSend = true;
        break;
      }
    }


    if (
      !shouldSend
    ) {
      continue;
    }


    await reminderService.sendReminder(
      user.id,
      user.email,
      "plan_expiry"
    );
  }
}


/* =========================================================
   MAIN REMINDER PROCESSOR
========================================================= */

async function processReminders() {
  try {
    const users =
      getAllUsers();

    if (!users.length) {
      return;
    }


    const currentTime =
      getCurrentTimeParts();


    await processMealReminders(
      users,
      currentTime
    );


    await processWorkoutReminders(
      users,
      currentTime
    );


    await processWeightCheckins(
      users,
      currentTime
    );


    await processProgressPhotoReminders(
      users,
      currentTime
    );


    await processPlanExpiryReminders(
      users,
      currentTime
    );

  } catch (error) {
    console.warn(
      "Reminder processing error:",
      error.message
    );
  }
}


/* =========================================================
   START
========================================================= */

function start() {
  if (started) {
    return;
  }

  started = true;


  /*
   * Run every minute.
   *
   * Each user's saved reminder_time is checked,
   * so users don't all have to use 06:00 or 08:00.
   */

  const job =
    cron.schedule(
      "* * * * *",
      async () => {
        await processReminders();
      },
      {
        timezone:
          SCHEDULER_TIMEZONE,
      }
    );


  jobs.push(job);


  console.log(
    `Reminder scheduler started (${SCHEDULER_TIMEZONE})`
  );
}


/* =========================================================
   STOP
========================================================= */

function stop() {
  for (const job of jobs) {
    if (
      job &&
      typeof job.stop ===
        "function"
    ) {
      job.stop();
    }
  }

  jobs = [];
  started = false;

  console.log(
    "Reminder scheduler stopped"
  );
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  start,
  stop,
  processReminders,
};