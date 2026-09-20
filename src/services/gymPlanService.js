const env = require("../config/env");
const llmService = require("./llmService");
const { EXERCISES } = require("../constants/exercises");

function safeParseJson(value, fallback) {
  try {
    if (Array.isArray(value)) return value;
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

const DAYS_OF_WEEK = Object.freeze([
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
]);

const GYM_DAYS = Object.freeze([
  { day: "Mon", focus: "push" },
  { day: "Tue", focus: "pull" },
  { day: "Wed", focus: "legs" },
  { day: "Thu", focus: "push" },
  { day: "Fri", focus: "pull" },
  { day: "Sat", focus: "cardio" },
  { day: "Sun", focus: "rest" },
]);

const INJURY_ALIASES = Object.freeze({
  shoulder: ["shoulder", "shoulders"],
  wrist: ["wrist", "hand"],
  knee: ["knee", "knees"],
  ankle: ["ankle", "ankles"],
  back: ["back", "lower back", "upper back", "spine"],
});

const MUSCLE_GROUPS = Object.freeze({
  push: ["chest", "shoulders", "triceps"],
  pull: ["back", "biceps", "lats", "rear_delts"],
  legs: ["quadriceps", "glutes", "hamstrings", "calves"],
});

function normalizeInjuries(injuries) {
  if (!Array.isArray(injuries)) return [];

  return injuries
    .map((injury) => {
      if (typeof injury === "string") {
        return injury.toLowerCase().trim();
      }

      return String(injury?.category || injury?.name || "")
        .toLowerCase()
        .trim();
    })
    .filter(Boolean);
}

function injuryMatchesCategory(injury, category) {
  const normalizedInjury = String(injury || "")
    .toLowerCase()
    .trim();

  const normalizedCategory = String(category || "")
    .toLowerCase()
    .trim();

  if (!normalizedInjury || !normalizedCategory) {
    return false;
  }

  if (normalizedInjury === normalizedCategory) {
    return true;
  }

  const aliases = INJURY_ALIASES[normalizedCategory] || [];

  return aliases.some(
    (alias) =>
      normalizedInjury === alias ||
      normalizedInjury.includes(alias)
  );
}

function isExerciseSafe(exercise, injuries) {
  const normalizedInjuries = normalizeInjuries(injuries);

  if (normalizedInjuries.length === 0) {
    return true;
  }

  const exerciseAvoid = Array.isArray(
    exercise?.injuries_to_avoid
  )
    ? exercise.injuries_to_avoid
    : [];

  return !exerciseAvoid.some((avoidCategory) =>
    normalizedInjuries.some((injury) =>
      injuryMatchesCategory(injury, avoidCategory)
    )
  );
}

function filterSafeExercises(exercises, injuries) {
  if (!Array.isArray(exercises)) {
    return [];
  }

  return exercises.filter((exercise) =>
    isExerciseSafe(exercise, injuries)
  );
}

function getDifficultyByExperience(level) {
  const normalizedLevel = String(level || "")
    .toLowerCase()
    .trim();

  if (
    normalizedLevel === "none" ||
    normalizedLevel === "beginner"
  ) {
    return "beginner";
  }

  if (normalizedLevel === "intermediate") {
    return "intermediate";
  }

  if (normalizedLevel === "advanced") {
    return "advanced";
  }

  return "beginner";
}

function getExercisesForFocus(availableExercises, focus) {
  if (focus === "cardio") {
    return availableExercises.filter(
      (exercise) =>
        exercise.category === "cardio" ||
        exercise.category === "flexibility"
    );
  }

  const targetMuscles = MUSCLE_GROUPS[focus] || [];

  return availableExercises.filter((exercise) => {
    if (exercise.category !== "strength") {
      return false;
    }

    return Array.isArray(exercise.muscle_groups)
      ? exercise.muscle_groups.some((muscle) =>
          targetMuscles.includes(muscle)
        )
      : false;
  });
}

function shuffleExercises(exercises) {
  return [...exercises].sort(() => Math.random() - 0.5);
}

function adjustSetsForExperience(difficulty, experience) {
  const level = String(experience || "")
    .toLowerCase()
    .trim();

  if (level === "none" || level === "beginner") {
    return 2;
  }

  if (level === "intermediate") {
    return difficulty === "advanced" ? 3 : 3;
  }

  if (level === "advanced") {
    if (difficulty === "beginner") return 3;
    if (difficulty === "intermediate") return 4;
    return 4;
  }

  return 3;
}

function adjustRepsForExperience(difficulty, experience) {
  const level = String(experience || "")
    .toLowerCase()
    .trim();

  if (level === "none" || level === "beginner") {
    return difficulty === "intermediate"
      ? "10-15"
      : "12-15";
  }

  if (level === "intermediate") {
    return "8-12";
  }

  if (level === "advanced") {
    if (difficulty === "beginner") return "8-12";
    if (difficulty === "intermediate") return "6-12";
    return "4-8";
  }

  return "10-15";
}

function generateRuleBasedGymPlan(profile, calculation) {
  const fitnessGoal =
    calculation.fitness_goal ||
    profile.fitness_goal ||
    "maintain";

  const injuries = safeParseJson(
    profile.injuries,
    []
  );

  const experience =
    profile.gym_experience_level ||
    "beginner";

  const targetDifficulty =
    getDifficultyByExperience(experience);

  const availableExercises =
    filterSafeExercises(EXERCISES, injuries);

  const weeklyPlan = GYM_DAYS.map((gymDay) => {
    if (gymDay.focus === "rest") {
      return {
        day: gymDay.day,
        focus: "rest",
        exercises: [
          {
            name: "Active Recovery",
            description:
              "Light walking, gentle mobility or stretching",
            sets: 1,
            reps: "5-10 minutes",
            focus: "rest",
          },
        ],
      };
    }

    let pool = getExercisesForFocus(
      availableExercises,
      gymDay.focus
    );

    // Prefer exercises appropriate for the user's experience.
    const difficultyPool = pool.filter(
      (exercise) =>
        exercise.difficulty === targetDifficulty
    );

    if (difficultyPool.length > 0) {
      pool = difficultyPool;
    }

    // If there are too few exercises for a specific focus,
    // use other safe exercises at the same difficulty.
    if (pool.length < 2) {
      const fallbackPool = availableExercises.filter(
        (exercise) =>
          exercise.category === "strength" &&
          exercise.difficulty === targetDifficulty
      );

      if (fallbackPool.length > 0) {
        pool = fallbackPool;
      }
    }

    const selectedExercises = [];
    const usedNames = new Set();

    const exerciseCount =
      gymDay.focus === "cardio" ? 3 : 4;

    const shuffled = shuffleExercises(pool);

    for (const exercise of shuffled) {
      if (
        selectedExercises.length >= exerciseCount
      ) {
        break;
      }

      if (usedNames.has(exercise.name)) {
        continue;
      }

      usedNames.add(exercise.name);

      selectedExercises.push({
        name: exercise.name,
        description: exercise.description,
        sets: adjustSetsForExperience(
          exercise.difficulty,
          experience
        ),
        reps: adjustRepsForExperience(
          exercise.difficulty,
          experience
        ),
        focus: gymDay.focus,
      });
    }

    return {
      day: gymDay.day,
      focus: gymDay.focus,
      exercises: selectedExercises,
    };
  });

  return {
    type: "rule_based",
    disclaimer:
      "This is a rule-based gym plan generated as a fallback. Stop any exercise that causes pain. For existing injuries or medical concerns, consult a qualified healthcare professional.",
    fitness_goal: fitnessGoal,
    gym_experience_level: experience,
    weekly_plan: weeklyPlan,
    generated_via: "rule_based",
  };
}

function normalizeDayName(day) {
  if (!day) return "";

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

  return map[value] || String(day);
}

function getKnownExercise(exerciseName) {
  if (!exerciseName) return null;

  const normalizedName = String(exerciseName)
    .toLowerCase()
    .trim();

  return (
    EXERCISES.find(
      (exercise) =>
        exercise.name.toLowerCase() === normalizedName
    ) || null
  );
}

function validateLlmGymPlan(plan, injuries) {
  const errors = [];

  if (!plan || typeof plan !== "object") {
    return {
      valid: false,
      errors: ["Invalid plan structure"],
    };
  }

  const weeklyPlan =
    plan.weekly_plan || plan;

  if (!Array.isArray(weeklyPlan)) {
    return {
      valid: false,
      errors: ["Missing weekly_plan array"],
    };
  }

  if (weeklyPlan.length !== 7) {
    errors.push(
      "Plan must contain exactly 7 days"
    );
  }

  const seenDays = new Set();

  for (
    let dayIdx = 0;
    dayIdx < weeklyPlan.length;
    dayIdx++
  ) {
    const day = weeklyPlan[dayIdx];

    if (!day || typeof day !== "object") {
      errors.push(
        `Day ${dayIdx + 1} has an invalid structure`
      );
      continue;
    }

    const dayName = normalizeDayName(day.day);

    if (!dayName) {
      errors.push(
        `Day ${dayIdx + 1} is missing a day name`
      );
    } else if (!DAYS_OF_WEEK.includes(dayName)) {
      errors.push(
        `Invalid day name "${day.day}"`
      );
    } else if (seenDays.has(dayName)) {
      errors.push(
        `Duplicate day "${dayName}"`
      );
    } else {
      seenDays.add(dayName);
    }

    if (!Array.isArray(day.exercises)) {
      errors.push(
        `Day ${dayIdx + 1} missing exercises array`
      );
      continue;
    }

    const focus = String(day.focus || "")
      .toLowerCase()
      .trim();

    if (!focus) {
      errors.push(
        `Day ${dayIdx + 1} missing focus`
      );
    }

    for (
      let exIdx = 0;
      exIdx < day.exercises.length;
      exIdx++
    ) {
      const exercise = day.exercises[exIdx];

      if (
        !exercise ||
        typeof exercise !== "object"
      ) {
        errors.push(
          `Day ${dayIdx + 1}, exercise ${
            exIdx + 1
          } is invalid`
        );
        continue;
      }

      const exerciseName =
        typeof exercise.name === "string"
          ? exercise.name.trim()
          : "";

      if (!exerciseName) {
        errors.push(
          `Day ${dayIdx + 1}, exercise ${
            exIdx + 1
          } is missing a name`
        );
        continue;
      }

      // When there are injuries, we only accept exercises
      // from the verified exercise catalog so their safety
      // restrictions can be checked.
      const knownExercise =
        getKnownExercise(exerciseName);

      const normalizedInjuries =
        normalizeInjuries(injuries);

      if (
        normalizedInjuries.length > 0 &&
        !knownExercise
      ) {
        errors.push(
          `Day ${dayIdx + 1} exercise "${exerciseName}" cannot be verified for injury safety`
        );
        continue;
      }

      if (
        knownExercise &&
        !isExerciseSafe(
          knownExercise,
          normalizedInjuries
        )
      ) {
        errors.push(
          `Day ${dayIdx + 1} exercise "${exerciseName}" conflicts with a reported injury`
        );
      }
    }
  }

  const restDays = weeklyPlan.filter((day) => {
    const focus = String(day?.focus || "")
      .toLowerCase()
      .trim();

    return (
      focus === "rest" ||
      focus === "recovery" ||
      focus === "active recovery"
    );
  });

  if (restDays.length < 1) {
    errors.push(
      "Plan must include at least 1 rest or recovery day"
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

async function generateGymPlan(
  profile,
  calculation,
  options = {}
) {
  const injuries = safeParseJson(
    profile.injuries,
    []
  );

  const fitnessGoal =
    calculation.fitness_goal ||
    profile.fitness_goal;

  if (
    llmService.isConfigured() &&
    !options.forceRuleBased
  ) {
    try {
      const prompt =
        llmService.buildGymPlanPrompt(
          profile,
          fitnessGoal,
          injuries
        );

      const rawContent =
        await llmService.callLLM(prompt, {
          temperature: 0.7,
        });

      const parsed =
        await llmService.parseLlmJson(
          rawContent
        );

      const validated =
        validateLlmGymPlan(
          parsed,
          injuries
        );

      if (validated.valid) {
        return {
          plan: {
            type: "ai_generated",
            disclaimer:
              "This gym plan was AI-generated. Stop any exercise that causes pain. For existing injuries or medical concerns, consult a qualified healthcare professional.",
            fitness_goal: fitnessGoal,
            gym_experience_level:
              profile.gym_experience_level ||
              "beginner",
            weekly_plan:
              parsed.weekly_plan || parsed,
            generated_via: "llm",
            model: env.llmModel,
          },
          source: "llm",
        };
      }

      console.warn(
        "LLM gym plan failed validation, falling back to rule-based:",
        validated.errors
      );

      return {
        plan:
          generateRuleBasedGymPlan(
            profile,
            calculation
          ),
        source: "rule_based_fallback",
        validationErrors:
          validated.errors,
      };
    } catch (err) {
      console.error(
        "LLM gym plan generation failed, falling back to rule-based:",
        err.message
      );

      return {
        plan:
          generateRuleBasedGymPlan(
            profile,
            calculation
          ),
        source: "rule_based_fallback",
        error: err.message,
      };
    }
  }

  return {
    plan:
      generateRuleBasedGymPlan(
        profile,
        calculation
      ),
    source: "rule_based",
  };
}

module.exports = {
  generateGymPlan,
  generateRuleBasedGymPlan,
  validateLlmGymPlan,
  isExerciseSafe,
  filterSafeExercises,
  DAYS_OF_WEEK,
};