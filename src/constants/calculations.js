const ACTIVITY_MULTIPLIERS = Object.freeze({
  sedentary: 1.20,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.90,
});

const GOAL_ADJUSTMENTS = Object.freeze({
  cut: 0.80,
  bulk: 1.10,
  maintain: 1.00,
  recomp: 0.95,
});

const MACRO_RATIOS = Object.freeze({
  cut: Object.freeze({ protein: 0.35, carbs: 0.40, fat: 0.25 }),
  bulk: Object.freeze({ protein: 0.30, carbs: 0.45, fat: 0.25 }),
  maintain: Object.freeze({ protein: 0.30, carbs: 0.45, fat: 0.25 }),
  recomp: Object.freeze({ protein: 0.35, carbs: 0.40, fat: 0.25 }),
});

const CALORIES_PER_GRAM = Object.freeze({
  protein: 4,
  carbs: 4,
  fat: 9,
});

const GENDER_MIFFLIN_CONSTANTS = Object.freeze({
  male: 5,
  female: -161,
});

const HISTORY_DEFAULT_DAYS = 56;
const HISTORY_MAX_DAYS = 365;
const HISTORY_MAX_LIMIT = 100;

module.exports = {
  ACTIVITY_MULTIPLIERS,
  GOAL_ADJUSTMENTS,
  MACRO_RATIOS,
  CALORIES_PER_GRAM,
  GENDER_MIFFLIN_CONSTANTS,
  HISTORY_DEFAULT_DAYS,
  HISTORY_MAX_DAYS,
  HISTORY_MAX_LIMIT,
};
