const { getDb } = require("../config/database");

const DAY_ABBREV = Object.freeze([
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
]);

const ALLOWED_SUMMARY_RANGES = Object.freeze([
  4,
  8,
  12,
]);

const DEFAULT_SUMMARY_RANGE = 4;

const ISO_DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}$/;


/* =========================================================
   VALIDATION ERROR
========================================================= */

class ValidationError extends Error {
  constructor(message, fields) {
    super(message);

    this.name = "ValidationError";
    this.status = 400;
    this.code = "VALIDATION_ERROR";
    this.fields = fields;
  }
}


/* =========================================================
   HELPERS
========================================================= */

function safeParseJson(value, fallback) {
  try {
    if (
      value &&
      typeof value === "object"
    ) {
      return value;
    }

    return value
      ? JSON.parse(value)
      : fallback;
  } catch {
    return fallback;
  }
}

function roundToTwo(value) {
  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
}

function clampPct(value) {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getISTTime(date) {
  return new Date(new Date(date).getTime() + IST_OFFSET_MS);
}

function parseDateStr(dateStr) {
  return new Date(
    `${dateStr}T00:00:00.000+05:30`
  );
}

function formatDate(date) {
  const ist = getISTTime(date);
  return ist.toISOString().slice(0, 10);
}

function addDaysUTC(date, days) {
  return new Date(
    new Date(date).getTime() + days * 24 * 60 * 60 * 1000
  );
}

function getDayAbbr(date) {
  const ist = getISTTime(date);
  return DAY_ABBREV[ist.getUTCDay()];
}

function startOfUTCMonday(date) {
  const ist = getISTTime(date);
  ist.setUTCHours(0, 0, 0, 0);
  const day = ist.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  ist.setUTCDate(ist.getUTCDate() + diff);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}


function getElapsedDayStrings(
  weekStartStr,
  todayStr
) {
  const days = [];

  const start =
    parseDateStr(weekStartStr);

  let current = start;

  for (let i = 0; i < 7; i++) {
    const currentStr =
      formatDate(current);

    if (
      currentStr > todayStr
    ) {
      break;
    }

    days.push(currentStr);

    current =
      addDaysUTC(
        current,
        1
      );
  }

  return days;
}


/* =========================================================
   PLAN COVERAGE
========================================================= */

function planCoversDay(
  plan,
  dayDateStr
) {
  if (!plan?.generated_at) {
    return false;
  }

  const generatedDate =
    String(
      plan.generated_at
    ).slice(0, 10);

  if (
    generatedDate > dayDateStr
  ) {
    return false;
  }

  if (plan.valid_until) {
    const validUntil =
      String(
        plan.valid_until
      ).slice(0, 10);

    if (
      !(validUntil > dayDateStr)
    ) {
      return false;
    }
  }

  return true;
}


function findApplicablePlan(
  plans,
  dayDateStr
) {
  for (
    let i = plans.length - 1;
    i >= 0;
    i--
  ) {
    if (
      planCoversDay(
        plans[i],
        dayDateStr
      )
    ) {
      return plans[i];
    }
  }

  return null;
}


/* =========================================================
   PLAN CONTENT
========================================================= */

function getPlanMealsForDay(
  planJson,
  dayAbbr
) {
  if (!planJson) {
    return [];
  }

  const parsed =
    safeParseJson(
      planJson,
      null
    );

  const weekly =
    parsed &&
    Array.isArray(
      parsed.weekly_plan
    )
      ? parsed.weekly_plan
      : [];

  const dayEntry =
    weekly.find(
      day =>
        day?.day === dayAbbr
    );

  return Array.isArray(
    dayEntry?.meals
  )
    ? dayEntry.meals
    : [];
}


function getPlanWorkoutForDay(
  planJson,
  dayAbbr
) {
  const parsed =
    safeParseJson(
      planJson,
      null
    );

  const weekly =
    parsed &&
    Array.isArray(
      parsed.weekly_plan
    )
      ? parsed.weekly_plan
      : [];

  return (
    weekly.find(
      day =>
        day?.day === dayAbbr
    ) || null
  );
}


/* =========================================================
   COMPLETION COUNTERS
========================================================= */

function getNumericCompletion(
  value,
  keys
) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  for (const key of keys) {
    const number =
      Number(
        value[key]
      );

    if (
      Number.isFinite(number) &&
      number >= 0
    ) {
      return number;
    }
  }

  return null;
}


function countMealCompletions(
  logs
) {
  let total = 0;

  for (
    const log of logs
  ) {
    const value =
      log.value_json;

    const explicit =
      getNumericCompletion(
        value,
        [
          "meals_hit",
          "mealsCompleted",
          "completed_meals",
        ]
      );

    total +=
      explicit !== null
        ? explicit
        : 1;
  }

  return total;
}


function countWorkoutCompletions(
  logs
) {
  let total = 0;

  for (
    const log of logs
  ) {
    const value =
      log.value_json;

    const explicit =
      getNumericCompletion(
        value,
        [
          "workouts_hit",
          "workoutsCompleted",
          "completed_workouts",
        ]
      );

    total +=
      explicit !== null
        ? explicit
        : 1;
  }

  return total;
}


/* =========================================================
   VALIDATION
========================================================= */

function validateWeekStart(
  weekStart
) {
  if (!weekStart) {
    return {
      valid: true,
    };
  }

  if (
    typeof weekStart !== "string" ||
    !ISO_DATE_REGEX.test(
      weekStart
    )
  ) {
    return {
      valid: false,
      message:
        "Invalid date format",
      fields: {
        week_start:
          "week_start must be a valid ISO date in YYYY-MM-DD format",
      },
    };
  }

  const date =
    parseDateStr(
      weekStart
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return {
      valid: false,
      message:
        "Invalid date",
      fields: {
        week_start:
          "week_start must be a valid ISO date in YYYY-MM-DD format",
      },
    };
  }

  if (
    formatDate(date) !==
    weekStart
  ) {
    return {
      valid: false,
      message:
        "Invalid date",
      fields: {
        week_start:
          "week_start must be a valid ISO date in YYYY-MM-DD format",
      },
    };
  }

  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  if (
    ist.getUTCDay() !== 1
  ) {
    return {
      valid: false,
      message:
        "week_start must represent a Monday",
      fields: {
        week_start:
          "week_start must be a Monday",
      },
    };
  }

  return {
    valid: true,
  };
}


function validateSummaryRange(
  weeks
) {
  if (
    weeks === undefined ||
    weeks === ""
  ) {
    return {
      valid: true,
      range:
        DEFAULT_SUMMARY_RANGE,
    };
  }

  const parsed =
    parseInt(
      weeks,
      10
    );

  if (
    Number.isNaN(parsed) ||
    !ALLOWED_SUMMARY_RANGES.includes(
      parsed
    )
  ) {
    return {
      valid: false,
      message:
        "Invalid range",
      fields: {
        weeks:
          "weeks must be one of 4, 8, or 12",
      },
    };
  }

  return {
    valid: true,
    range: parsed,
  };
}


/* =========================================================
   DATABASE
========================================================= */

function getPlanRows(
  db,
  table,
  jsonField,
  userId
) {
  return (
    db
      .prepare(
        `
        SELECT
          id,
          ${jsonField},
          generated_at,
          valid_until
        FROM ${table}
        WHERE user_id = ?
        ORDER BY
          generated_at ASC,
          id ASC
        `
      )
      .all(userId) || []
  );
}


function fetchComplianceLogs(
  db,
  userId,
  logType,
  rangeStartISO,
  rangeEndISO
) {
  const rows =
    db
      .prepare(
        `
        SELECT
          value_json,
          logged_at
        FROM progress_logs
        WHERE
          user_id = ?
          AND log_type = ?
          AND logged_at >= ?
          AND logged_at <= ?
        ORDER BY
          logged_at ASC,
          id ASC
        `
      )
      .all(
        userId,
        logType,
        rangeStartISO,
        rangeEndISO
      );

  return rows.map(
    row => ({
      value_json:
        safeParseJson(
          row.value_json,
          {}
        ),
      logged_at:
        row.logged_at,
    })
  );
}


/* =========================================================
   DIET ADHERENCE
========================================================= */

function calculateDietAdherence(
  db,
  userId,
  elapsedDays,
  dietPlans,
  weekStartStr
) {
  let expected = 0;

  for (
    const dayStr of elapsedDays
  ) {
    const dayAbbr =
      getDayAbbr(
        parseDateStr(
          dayStr
        )
      );

    const plan =
      findApplicablePlan(
        dietPlans,
        dayStr
      );

    if (!plan) {
      continue;
    }

    expected +=
      getPlanMealsForDay(
        plan.meals_json,
        dayAbbr
      ).length;
  }

  if (
    dietPlans.length === 0 ||
    expected === 0
  ) {
    return {
      adherence_percentage: null,
      meals_hit: 0,
      meals_missed: 0,
      meals_expected: 0,

      has_activity: false,

      message:
        dietPlans.length === 0
          ? "No diet plan available for the selected period."
          : "No diet plan applicable for the selected period.",
    };
  }


  const rangeStartISO =
    parseDateStr(weekStartStr).toISOString();

  const lastDay =
    elapsedDays[
      elapsedDays.length - 1
    ];

  const rangeEndISO =
    new Date(`${lastDay}T23:59:59.999+05:30`).toISOString();


  const logs =
    fetchComplianceLogs(
      db,
      userId,
      "meal_compliance",
      rangeStartISO,
      rangeEndISO
    );


  /*
   * No meal-compliance records means
   * adherence is 0%.
   */

  const hit =
    countMealCompletions(
      logs
    );

  const missed =
    Math.max(
      0,
      expected - hit
    );

  const percentage =
    roundToTwo(
      clampPct(
        (hit / expected) * 100
      )
    );


  return {
    adherence_percentage:
      percentage,

    meals_hit:
      hit,

    meals_missed:
      missed,

    meals_expected:
      expected,

    has_activity: true,

    message: null,
  };
}


/* =========================================================
   GYM ADHERENCE
========================================================= */

function calculateGymAdherence(
  db,
  userId,
  elapsedDays,
  gymPlans,
  weekStartStr
) {
  let expected = 0;

  for (
    const dayStr of elapsedDays
  ) {
    const dayAbbr =
      getDayAbbr(
        parseDateStr(
          dayStr
        )
      );

    const plan =
      findApplicablePlan(
        gymPlans,
        dayStr
      );

    if (!plan) {
      continue;
    }

    const dayEntry =
      getPlanWorkoutForDay(
        plan.workouts_json,
        dayAbbr
      );

    if (!dayEntry) {
      continue;
    }

    const focus =
      String(
        dayEntry.focus || ""
      )
        .toLowerCase()
        .trim();

    if (
      [
        "rest",
        "recovery",
        "active recovery",
      ].includes(focus)
    ) {
      continue;
    }

    expected += 1;
  }


  if (
    gymPlans.length === 0 ||
    expected === 0
  ) {
    return {
      adherence_percentage: null,
      workouts_completed: 0,
      workouts_missed: 0,
      workouts_expected: 0,

      has_activity: false,

      message:
        gymPlans.length === 0
          ? "No gym plan available for the selected period."
          : "No gym workouts applicable for the selected period.",
    };
  }


  const rangeStartISO =
    parseDateStr(weekStartStr).toISOString();

  const lastDay =
    elapsedDays[
      elapsedDays.length - 1
    ];

  const rangeEndISO =
    new Date(`${lastDay}T23:59:59.999+05:30`).toISOString();


  const logs =
    fetchComplianceLogs(
      db,
      userId,
      "workout_completion",
      rangeStartISO,
      rangeEndISO
    );


  /*
   * No workout-completion records means
   * adherence is 0%.
   */

  const completed =
    countWorkoutCompletions(
      logs
    );

  const missed =
    Math.max(
      0,
      expected - completed
    );

  const percentage =
    roundToTwo(
      clampPct(
        (completed / expected) *
          100
      )
    );


  return {
    adherence_percentage:
      percentage,

    workouts_completed:
      completed,

    workouts_missed:
      missed,

    workouts_expected:
      expected,

    has_activity: true,

    message: null,
  };
}


/* =========================================================
   WEEKLY ADHERENCE
========================================================= */

async function getWeeklyAdherence(
  userId,
  options = {}
) {
  const {
    week_start,
    now,
  } = options;

  const db =
    getDb();


  const validation =
    validateWeekStart(
      week_start
    );

  if (!validation.valid) {
    throw new ValidationError(
      validation.message,
      validation.fields
    );
  }


  const today =
    now
      ? new Date(now)
      : new Date();


  if (
    Number.isNaN(
      today.getTime()
    )
  ) {
    throw new ValidationError(
      "Invalid current date",
      {
        now:
          "now must be a valid date",
      }
    );
  }


  const todayStr =
    formatDate(today);


  const weekStartStr =
    week_start ||
    formatDate(
      startOfUTCMonday(
        today
      )
    );


  const weekStartDate =
    parseDateStr(
      weekStartStr
    );


  const weekEndDate =
    addDaysUTC(
      weekStartDate,
      6
    );


  const weekEndStr =
    formatDate(
      weekEndDate
    );


  const elapsedDays =
    getElapsedDayStrings(
      weekStartStr,
      todayStr
    );


  const isPartialWeek =
    todayStr <= weekEndStr;


  const dietPlans =
    getPlanRows(
      db,
      "diet_plans",
      "meals_json",
      userId
    );


  const gymPlans =
    getPlanRows(
      db,
      "gym_plans",
      "workouts_json",
      userId
    );


  const diet =
    calculateDietAdherence(
      db,
      userId,
      elapsedDays,
      dietPlans,
      weekStartStr
    );


  const gym =
    calculateGymAdherence(
      db,
      userId,
      elapsedDays,
      gymPlans,
      weekStartStr
    );


  const hasAnyActivity =
    diet.has_activity ||
    gym.has_activity;


  const totalExpected =
    diet.meals_expected +
    gym.workouts_expected;


  const totalCompleted =
    diet.meals_hit +
    gym.workouts_completed;


  let overallPercentage =
    null;

  let overallMessage =
    null;


  if (!hasAnyActivity) {
    if (dietPlans.length === 0 && gymPlans.length === 0) {
      overallMessage = "User has no diet or gym plan.";
    } else {
      overallMessage = "No meal or workout adherence activity has been recorded yet.";
    }
  } else if (
    totalExpected > 0
  ) {
    overallPercentage =
      roundToTwo(
        clampPct(
          (totalCompleted /
            totalExpected) *
            100
        )
      );
  } else {
    overallMessage =
      "No applicable plan coverage exists for the selected period.";
  }


  return {
    data: {

      week_start:
        weekStartStr,

      week_end:
        weekEndStr,

      days_in_period:
        elapsedDays.length,

      is_partial_week:
        isPartialWeek,

      diet,

      gym,

      overall: {

        overall_adherence_percentage:
          overallPercentage,

        message:
          overallMessage,
      },


      adherence:
        overallPercentage,

      percentage:
        overallPercentage,

    },

    message:
      "Weekly adherence retrieved successfully",
  };
}


/* =========================================================
   SUMMARY
========================================================= */

async function getAdherenceSummary(
  userId,
  options = {}
) {
  const {
    weeks,
    now,
  } = options;

  const validation =
    validateSummaryRange(
      weeks
    );

  if (!validation.valid) {
    throw new ValidationError(
      validation.message,
      validation.fields
    );
  }


  const range =
    validation.range;


  const today =
    now
      ? new Date(now)
      : new Date();


  if (
    Number.isNaN(
      today.getTime()
    )
  ) {
    throw new ValidationError(
      "Invalid current date",
      {
        now:
          "now must be a valid date",
      }
    );
  }


  const todayStr =
    formatDate(today);


  const currentMonday =
    startOfUTCMonday(
      today
    );


  const weekResults = [];


  for (
    let i = range - 1;
    i >= 0;
    i--
  ) {
    const weekStartStr =
      formatDate(
        addDaysUTC(
          currentMonday,
          -i * 7
        )
      );


    const weekly =
      await getWeeklyAdherence(
        userId,
        {
          week_start:
            weekStartStr,

          now:
            `${todayStr}T12:00:00.000Z`,
        }
      );


    weekResults.push({
      week_start:
        weekly.data.week_start,

      week_end:
        weekly.data.week_end,

      days_in_period:
        weekly.data.days_in_period,

      is_partial_week:
        weekly.data.is_partial_week,

      overall_adherence_percentage:
        weekly.data.overall
          .overall_adherence_percentage,

      diet_adherence_percentage:
        weekly.data.diet
          .adherence_percentage,

      gym_adherence_percentage:
        weekly.data.gym
          .adherence_percentage,
    });
  }


  const averageOverall =
    averageNonNull(
      weekResults.map(
        week =>
          week.overall_adherence_percentage
      )
    );


  const averageDiet =
    averageNonNull(
      weekResults.map(
        week =>
          week.diet_adherence_percentage
      )
    );


  const averageGym =
    averageNonNull(
      weekResults.map(
        week =>
          week.gym_adherence_percentage
      )
    );


  return {
    data: {

      range_weeks:
        range,

      weeks:
        weekResults,

      averages: {

        overall_adherence_percentage:
          averageOverall,

        diet_adherence_percentage:
          averageDiet,

        gym_adherence_percentage:
          averageGym,

      },


      overall:
        averageOverall,

      adherence:
        averageOverall,

      percentage:
        averageOverall,

    },

    message:
      `Adherence summary (${range} weeks) retrieved successfully`,
  };
}


/* =========================================================
   AVERAGE
========================================================= */

function averageNonNull(
  values
) {
  const valid =
    values.filter(
      value =>
        value !== null &&
        value !== undefined &&
        Number.isFinite(
          Number(value)
        )
    );


  if (
    valid.length === 0
  ) {
    return null;
  }


  const sum =
    valid.reduce(
      (
        total,
        value
      ) =>
        total +
        Number(value),
      0
    );


  return roundToTwo(
    sum /
      valid.length
  );
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  ValidationError,

  validateWeekStart,

  validateSummaryRange,

  getWeeklyAdherence,

  getAdherenceSummary,

  calculateDietAdherence,

  calculateGymAdherence,

  findApplicablePlan,

  planCoversDay,

  countMealCompletions,

  countWorkoutCompletions,

  getElapsedDayStrings,

  formatDate,

  parseDateStr,

  startOfUTCMonday,

  addDaysUTC,

  getDayAbbr,

  averageNonNull,

  ALLOWED_SUMMARY_RANGES,

  DEFAULT_SUMMARY_RANGE,
};