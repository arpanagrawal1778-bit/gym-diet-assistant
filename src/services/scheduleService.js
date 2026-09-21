const env = require("../config/env");
const { DAYS_OF_WEEK } = require("./dietPlanService");

const WEEKDAYS = Object.freeze([
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
]);

const WEEKENDS = Object.freeze([
  "Sat",
  "Sun",
]);

const DEFAULT_TIMES = Object.freeze({
  breakfast: "07:30",
  lunch: "13:00",
  snack: "16:30",
  dinner: "20:00",
  workout: "18:00",
});

const MEAL_TYPES = Object.freeze([
  "breakfast",
  "lunch",
  "snack",
  "dinner",
]);

function safeParseJson(value, fallback) {
  try {
    if (Array.isArray(value)) {
      return value;
    }

    if (value && typeof value === "object") {
      return value;
    }

    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}


/* =========================================================
   TIME HELPERS
========================================================= */

function parseTime(timeStr) {
  if (!timeStr) {
    return null;
  }

  const match = String(timeStr)
    .trim()
    .match(
      /^([01]?\d|2[0-3]):([0-5]\d)$/
    );

  if (!match) {
    return null;
  }

  const hours = parseInt(
    match[1],
    10
  );

  const minutes = parseInt(
    match[2],
    10
  );

  return {
    hours,
    minutes,
    totalMinutes:
      hours * 60 + minutes,
  };
}

function formatTime(totalMinutes) {
  let minutes = Number(totalMinutes);

  if (!Number.isFinite(minutes)) {
    return null;
  }

  // Keep time inside one day.
  minutes = Math.max(
    0,
    Math.min(1439, Math.round(minutes))
  );

  const hours = Math.floor(
    minutes / 60
  );

  const mins =
    minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(
    mins
  ).padStart(2, "0")}`;
}

function addMinutes(timeStr, minutesToAdd) {
  const parsed = parseTime(timeStr);

  if (!parsed) {
    return null;
  }

  return formatTime(
    parsed.totalMinutes +
      minutesToAdd
  );
}

function durationBetween(
  startTime,
  endTime
) {
  const start = parseTime(startTime);
  const end = parseTime(endTime);

  if (!start || !end) {
    return 0;
  }

  return Math.max(
    0,
    end.totalMinutes -
      start.totalMinutes
  );
}


/* =========================================================
   DAY HELPERS
========================================================= */

function normalizeDay(day) {
  if (!day) {
    return "";
  }

  const value = String(day)
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

  return map[value] || day;
}

function normalizeCollegeDays(collegeDays) {
  if (!Array.isArray(collegeDays)) {
    return [];
  }

  return collegeDays
    .map(normalizeDay)
    .filter((day) =>
      DAYS_OF_WEEK.includes(day)
    );
}

function isCollegeDay(
  collegeDays,
  day
) {
  const days =
    normalizeCollegeDays(
      collegeDays
    );

  return days.includes(
    normalizeDay(day)
  );
}


/* =========================================================
   MEAL HELPERS
========================================================= */

function detectMealType(
  meal,
  index
) {
  const combinedText = [
    meal?.name,
    meal?.description,
    meal?.timing,
    meal?.type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    combinedText.includes("breakfast")
  ) {
    return "breakfast";
  }

  if (
    combinedText.includes("lunch")
  ) {
    return "lunch";
  }

  if (
    combinedText.includes("dinner")
  ) {
    return "dinner";
  }

  if (
    combinedText.includes("snack")
  ) {
    return "snack";
  }

  // Diet plans already contain 4 meals in order.
  return (
    MEAL_TYPES[index] ||
    "snack"
  );
}

function getMealTime(
  mealType,
  isCollegeDayValue,
  collegeStart,
  collegeEnd
) {
  if (
    !isCollegeDayValue ||
    !collegeStart ||
    !collegeEnd
  ) {
    return DEFAULT_TIMES[mealType];
  }

  const start =
    collegeStart.totalMinutes;

  const end =
    collegeEnd.totalMinutes;

  switch (mealType) {
    case "breakfast": {
      // About 60-90 minutes before college.
      const preferred =
        start - 90;

      return formatTime(
        Math.max(
          360,
          preferred
        )
      );
    }

    case "lunch": {
      // Try to place lunch around the middle of
      // the college day. Since the profile only
      // provides overall college hours, this is
      // treated as a meal break.
      const preferred =
        13 * 60;

      return formatTime(
        Math.max(
          start,
          Math.min(
            end - 30,
            preferred
          )
        )
      );
    }

    case "snack": {
      // If college ends before the normal snack time,
      // put the snack shortly after college.
      const preferred =
        16 * 60 + 30;

      return formatTime(
        Math.max(
          start,
          Math.min(
            end + 30,
            preferred
          )
        )
      );
    }

    case "dinner":
      return DEFAULT_TIMES.dinner;

    default:
      return DEFAULT_TIMES.snack;
  }
}

function getDietMealTiming(
  hour,
  collegeStartTime,
  collegeEndTime
) {
  if (
    collegeStartTime ===
      undefined ||
    collegeStartTime === null
  ) {
    return defaultMealTiming(
      hour
    );
  }

  if (
    collegeEndTime ===
      undefined ||
    collegeEndTime === null
  ) {
    return defaultMealTiming(
      hour
    );
  }

  const start =
    parseTime(
      collegeStartTime
    );

  const end =
    parseTime(
      collegeEndTime
    );

  if (!start || !end) {
    return defaultMealTiming(
      hour
    );
  }

  if (
    hour < start.hours
  ) {
    return "pre_college";
  }

  if (
    hour >= end.hours
  ) {
    return "post_college";
  }

  return "during_college";
}

function defaultMealTiming(hour) {
  if (
    hour >= 22 ||
    hour < 7
  ) {
    return "late_night";
  }

  if (
    hour >= 7 &&
    hour < 11
  ) {
    return "breakfast";
  }

  if (
    hour >= 11 &&
    hour < 15
  ) {
    return "lunch";
  }

  if (
    hour >= 15 &&
    hour < 19
  ) {
    return "snack";
  }

  if (
    hour >= 19 &&
    hour < 22
  ) {
    return "dinner";
  }

  return "evening";
}


/* =========================================================
   DIET / GYM NORMALIZATION
========================================================= */

function getDietByDay(
  dietPlan
) {
  const result = {};

  const weeklyPlan =
    dietPlan?.weekly_plan;

  if (!Array.isArray(weeklyPlan)) {
    return result;
  }

  weeklyPlan.forEach(
    (dayPlan) => {
      const day =
        normalizeDay(
          dayPlan?.day
        );

      if (
        !DAYS_OF_WEEK.includes(day)
      ) {
        return;
      }

      result[day] =
        Array.isArray(
          dayPlan.meals
        )
          ? dayPlan.meals
          : [];
    }
  );

  return result;
}

function getGymByDay(
  gymPlan
) {
  const result = {};

  const weeklyPlan =
    gymPlan?.weekly_plan;

  if (!Array.isArray(weeklyPlan)) {
    return result;
  }

  weeklyPlan.forEach(
    (dayPlan) => {
      const day =
        normalizeDay(
          dayPlan?.day
        );

      if (
        !DAYS_OF_WEEK.includes(day)
      ) {
        return;
      }

      result[day] = {
        focus:
          dayPlan.focus ||
          "workout",

        exercises:
          Array.isArray(
            dayPlan.exercises
          )
            ? dayPlan.exercises
            : [],
      };
    }
  );

  return result;
}


/* =========================================================
   SCHEDULING
========================================================= */

function createCollegeEvent(
  startTime,
  endTime
) {
  if (!startTime || !endTime) {
    return null;
  }

  return {
    type: "college",
    title: "College",
    start_time: startTime,
    end_time: endTime,
    duration_minutes:
      durationBetween(
        startTime,
        endTime
      ),
  };
}

function createMealEvent(
  meal,
  mealType,
  startTime
) {
  if (!meal || !startTime) {
    return null;
  }

  const duration =
    mealType === "snack"
      ? 15
      : 30;

  return {
    type: "meal",
    meal_type: mealType,
    title:
      meal.name ||
      formatMealType(
        mealType
      ),
    description:
      meal.description ||
      "",
    start_time: startTime,
    end_time: addMinutes(
      startTime,
      duration
    ),
    duration_minutes:
      duration,
    calories:
      meal.calories ??
      null,
    protein_grams:
      meal.protein_grams ??
      null,
    carbs_grams:
      meal.carbs_grams ??
      null,
    fat_grams:
      meal.fat_grams ??
      null,
  };
}

function formatMealType(
  mealType
) {
  return String(
    mealType || "Meal"
  )
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (char) =>
        char.toUpperCase()
    );
}

function createWorkoutEvent(
  gymDay,
  startTime,
  experience
) {
  if (!gymDay) {
    return null;
  }

  const isRest =
    ["rest", "recovery", "active recovery"]
      .includes(
        String(
          gymDay.focus || ""
        )
          .toLowerCase()
          .trim()
      );

  if (isRest) {
    return {
      type: "recovery",
      title:
        "Rest / Active Recovery",
      start_time: null,
      end_time: null,
      duration_minutes: 0,
      focus: "recovery",
      exercises:
        gymDay.exercises || [],
    };
  }

  const level =
    String(
      experience || "beginner"
    )
      .toLowerCase()
      .trim();

  let duration = 45;

  if (level === "intermediate") {
    duration = 50;
  }

  if (level === "advanced") {
    duration = 60;
  }

  return {
    type: "workout",
    title: "Workout",
    focus:
      gymDay.focus ||
      "workout",
    start_time: startTime,
    end_time: addMinutes(
      startTime,
      duration
    ),
    duration_minutes:
      duration,
    exercises:
      gymDay.exercises || [],
  };
}

function getWorkoutTime(
  isCollegeDayValue,
  collegeStart,
  collegeEnd,
  mealEvents
) {
  /*
   * Main strategy:
   * - College day: workout after college.
   * - If college ends late, use an early-morning slot.
   * - Non-college day: use the evening slot.
   */

  if (
    isCollegeDayValue &&
    collegeEnd
  ) {
    const end =
      collegeEnd.totalMinutes;

    // There should be at least a small gap
    // after college before exercise.
    if (
      end + 60 <=
      21 * 60
    ) {
      return formatTime(
        end + 60
      );
    }

    // Late college day:
    // morning workout.
    return "06:30";
  }

  // Try to avoid dinner overlap.
  const dinner =
    mealEvents.find(
      (event) =>
        event.meal_type ===
        "dinner"
    );

  if (dinner) {
    const dinnerStart =
      parseTime(
        dinner.start_time
      );

    if (dinnerStart) {
      return formatTime(
        dinnerStart
          .totalMinutes - 90
      );
    }
  }

  return DEFAULT_TIMES.workout;
}

function sortTimeline(events) {
  return events
    .filter(Boolean)
    .sort((a, b) => {
      const aTime =
        parseTime(
          a.start_time
        );

      const bTime =
        parseTime(
          b.start_time
        );

      if (!aTime && !bTime) {
        return 0;
      }

      if (!aTime) {
        return 1;
      }

      if (!bTime) {
        return -1;
      }

      return (
        aTime.totalMinutes -
        bTime.totalMinutes
      );
    });
}


/* =========================================================
   CONFLICT DETECTION
========================================================= */

function eventsOverlap(
  first,
  second
) {
  if (
    !first?.start_time ||
    !first?.end_time ||
    !second?.start_time ||
    !second?.end_time
  ) {
    return false;
  }

  // Allow meals during college (e.g., lunch breaks)
  if (
    (first.type === "college" && second.type === "meal") ||
    (first.type === "meal" && second.type === "college")
  ) {
    return false;
  }

  const firstStart =
    parseTime(
      first.start_time
    );

  const firstEnd =
    parseTime(
      first.end_time
    );

  const secondStart =
    parseTime(
      second.start_time
    );

  const secondEnd =
    parseTime(
      second.end_time
    );

  if (
    !firstStart ||
    !firstEnd ||
    !secondStart ||
    !secondEnd
  ) {
    return false;
  }

  return (
    firstStart.totalMinutes <
      secondEnd.totalMinutes &&
    firstEnd.totalMinutes >
      secondStart.totalMinutes
  );
}

function detectConflicts(
  timeline
) {
  const conflicts = [];

  for (
    let i = 0;
    i < timeline.length;
    i++
  ) {
    for (
      let j = i + 1;
      j < timeline.length;
      j++
    ) {
      if (
        eventsOverlap(
          timeline[i],
          timeline[j]
        )
      ) {
        conflicts.push({
          first:
            timeline[i].title,
          second:
            timeline[j].title,
        });
      }
    }
  }

  return conflicts;
}


/* =========================================================
   DAY SCHEDULE
========================================================= */

function generateDaySchedule({
  day,
  profile,
  dietMeals,
  gymDay,
}) {
  const collegeDays =
    normalizeCollegeDays(
      safeParseJson(
        profile.college_days,
        []
      )
    );

  const collegeStart =
    parseTime(
      profile.college_start_time
    );

  const collegeEnd =
    parseTime(
      profile.college_end_time
    );

  const isCollegeDayValue =
    collegeDays.includes(day) &&
    Boolean(
      collegeStart &&
      collegeEnd
    );

  const timeline = [];

  /*
   * College
   */

  if (
    isCollegeDayValue
  ) {
    timeline.push(
      createCollegeEvent(
        profile.college_start_time,
        profile.college_end_time
      )
    );
  }


  /*
   * Meals
   */

  const mealEvents = [];

  dietMeals.forEach(
    (meal, index) => {
      const mealType =
        detectMealType(
          meal,
          index
        );

      const mealTime =
        getMealTime(
          mealType,
          isCollegeDayValue,
          collegeStart,
          collegeEnd
        );

      const event =
        createMealEvent(
          meal,
          mealType,
          mealTime
        );

      if (event) {
        mealEvents.push(
          event
        );

        timeline.push(
          event
        );
      }
    }
  );


  /*
   * Workout
   */

  let workoutEvent = null;

  if (gymDay) {
    const workoutTime =
      getWorkoutTime(
        isCollegeDayValue,
        collegeStart,
        collegeEnd,
        mealEvents
      );

    workoutEvent =
      createWorkoutEvent(
        gymDay,
        workoutTime,
        profile.gym_experience_level
      );

    if (
      workoutEvent
    ) {
      timeline.push(
        workoutEvent
      );
    }
  }


  const sortedTimeline =
    sortTimeline(
      timeline
    );

  const conflicts =
    detectConflicts(
      sortedTimeline
    );


  return {
    day,

    is_college_day:
      isCollegeDayValue,

    college_hours:
      isCollegeDayValue
        ? `${profile.college_start_time} - ${profile.college_end_time}`
        : null,

    meals: dietMeals,

    workouts:
      gymDay?.exercises || [],

    workout_focus:
      gymDay?.focus ||
      "rest",

    timeline:
      sortedTimeline,

    conflicts,

    has_conflicts:
      conflicts.length > 0,
  };
}


/* =========================================================
   MAIN GENERATOR
========================================================= */

function generateSchedule(
  profile,
  dietPlan,
  gymPlan
) {
  const collegeDays =
    normalizeCollegeDays(
      safeParseJson(
        profile.college_days,
        []
      )
    );

  const collegeStart =
    parseTime(
      profile.college_start_time
    );

  const collegeEnd =
    parseTime(
      profile.college_end_time
    );

  const dietByDay =
    getDietByDay(
      dietPlan
    );

  const gymByDay =
    getGymByDay(
      gymPlan
    );

  const schedule = {
    type: "merged_schedule",

    disclaimer:
      "This is an auto-generated weekly schedule combining college, meals, workouts and recovery. Adjust it to your actual class timetable and stop any exercise that causes pain.",

    profile_info: {
      college_start_time:
        profile.college_start_time ||
        null,

      college_end_time:
        profile.college_end_time ||
        null,

      college_days:
        collegeDays,

      gym_experience_level:
        profile.gym_experience_level ||
        "beginner",

      fitness_goal:
        profile.fitness_goal ||
        "",
    },

    weekly_schedule: {},

    generated_via:
      "rule_based_smart_schedule",
  };


  for (
    const day of DAYS_OF_WEEK
  ) {
    schedule.weekly_schedule[
      day
    ] =
      generateDaySchedule({
        day,
        profile,
        dietMeals:
          dietByDay[day] || [],
        gymDay:
          gymByDay[day] || null,
      });
  }


  return schedule;
}


/* =========================================================
   LEGACY MEAL FILTER
========================================================= */

function filterMealsByTime(
  meals,
  timing
) {
  if (!Array.isArray(meals)) {
    return [];
  }

  const timingMap = {
    pre_college: [
      "breakfast",
    ],

    during_college: [
      "lunch",
      "snack",
    ],

    post_college: [
      "snack",
      "dinner",
    ],
  };

  const allowed =
    timingMap[timing] ||
    [];

  return meals.filter(
    (meal, index) => {
      const type =
        detectMealType(
          meal,
          index
        );

      return allowed.includes(
        type
      );
    }
  );
}


/* =========================================================
   VALIDITY
========================================================= */

function getScheduleValidityDays() {
  return env.planValidityDays;
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  generateSchedule,
  parseTime,
  isCollegeDay,
  getDietMealTiming,
  filterMealsByTime,
  getScheduleValidityDays,
  WEEKDAYS,
  WEEKENDS,
};