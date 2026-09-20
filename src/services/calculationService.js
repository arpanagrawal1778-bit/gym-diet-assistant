const {
  ACTIVITY_MULTIPLIERS,
  GOAL_ADJUSTMENTS,
  MACRO_RATIOS,
  CALORIES_PER_GRAM,
  GENDER_MIFFLIN_CONSTANTS,
} = require("../constants/calculations");

function calculateBMR(profile) {
  const { gender, weight, height, age } = profile;

  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error("Invalid weight for BMR calculation");
  }
  if (!Number.isFinite(height) || height <= 0) {
    throw new Error("Invalid height for BMR calculation");
  }
  if (!Number.isFinite(age) || age <= 0) {
    throw new Error("Invalid age for BMR calculation");
  }

  const constant = GENDER_MIFFLIN_CONSTANTS[gender];
  if (constant === undefined) {
    throw new Error(`No BMR formula available for gender: ${gender}`);
  }

  const bmr = 10 * weight + 6.25 * height - 5 * age + constant;
  return Math.round(bmr);
}

function calculateTDEE(bmr, activityLevel) {
  if (!Number.isFinite(bmr) || bmr <= 0) {
    throw new Error("Invalid BMR for TDEE calculation");
  }
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  if (multiplier === undefined) {
    throw new Error(`Invalid activity level: ${activityLevel}`);
  }
  const tdee = bmr * multiplier;
  return Math.round(tdee);
}

function calculateCalorieTarget(tdee, fitnessGoal) {
  if (!Number.isFinite(tdee) || tdee <= 0) {
    throw new Error("Invalid TDEE for calorie target calculation");
  }
  const adjustment = GOAL_ADJUSTMENTS[fitnessGoal];
  if (adjustment === undefined) {
    throw new Error(`Invalid fitness goal: ${fitnessGoal}`);
  }
  const calorieTarget = tdee * adjustment;
  return Math.round(calorieTarget);
}

function calculateMacros(calorieTarget, fitnessGoal) {
  if (!Number.isFinite(calorieTarget) || calorieTarget <= 0) {
    throw new Error("Invalid calorie target for macro calculation");
  }
  const ratios = MACRO_RATIOS[fitnessGoal];
  if (!ratios) {
    throw new Error(`Invalid fitness goal for macros: ${fitnessGoal}`);
  }

  const { protein, carbs, fat } = ratios;
  const totalRatio = protein + carbs + fat;
  if (Math.abs(totalRatio - 1.0) > 0.001) {
    throw new Error(
      `Invalid macro configuration: ratios sum to ${totalRatio}, expected 1.0`
    );
  }

  const proteinGrams = Math.round((calorieTarget * protein) / CALORIES_PER_GRAM.protein);
  const carbsGrams = Math.round((calorieTarget * carbs) / CALORIES_PER_GRAM.carbs);
  const fatGrams = Math.round((calorieTarget * fat) / CALORIES_PER_GRAM.fat);

  if (proteinGrams < 0 || carbsGrams < 0 || fatGrams < 0) {
    throw new Error("Negative macro values calculated");
  }

  return {
    protein_grams: proteinGrams,
    carbs_grams: carbsGrams,
    fat_grams: fatGrams,
  };
}

function calculateAll(profile) {
  const bmr = calculateBMR(profile);
  const tdee = calculateTDEE(bmr, profile.activity_level);
  const calorieTarget = calculateCalorieTarget(tdee, profile.fitness_goal);
  const macros = calculateMacros(calorieTarget, profile.fitness_goal);

  return {
    bmr,
    tdee,
    calorie_target: calorieTarget,
    fitness_goal: profile.fitness_goal,
    activity_level: profile.activity_level,
    ...macros,
  };
}

module.exports = {
  calculateBMR,
  calculateTDEE,
  calculateCalorieTarget,
  calculateMacros,
  calculateAll,
};
