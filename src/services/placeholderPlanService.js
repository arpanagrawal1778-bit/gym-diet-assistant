function generatePlaceholderPlan(calorieTarget, proteinGrams, carbsGrams, fatGrams, fitnessGoal) {
  if (!Number.isFinite(calorieTarget) || calorieTarget <= 0) {
    throw new Error("Invalid calorie target for placeholder plan");
  }

  const meals = [];
  const mealCount = 4;
  const perMealCalories = Math.round(calorieTarget / mealCount);
  const perMealProtein = Math.round(proteinGrams / mealCount);
  const perMealCarbs = Math.round(carbsGrams / mealCount);
  const perMealFat = Math.round(fatGrams / mealCount);

  const mealNames = ["Breakfast", "Lunch", "Dinner", "Snack"];

  for (let i = 0; i < mealCount; i++) {
    meals.push({
      name: mealNames[i] || `Meal ${i + 1}`,
      calories: perMealCalories,
      protein_grams: perMealProtein,
      carbs_grams: perMealCarbs,
      fat_grams: perMealFat,
    });
  }

  return {
    type: "placeholder",
    disclaimer: "This is a rule-based placeholder plan, not medical or dietary advice.",
    calorie_target: calorieTarget,
    protein_grams: proteinGrams,
    carbs_grams: carbsGrams,
    fat_grams: fatGrams,
    fitness_goal: fitnessGoal,
    meals,
  };
}

module.exports = { generatePlaceholderPlan };
