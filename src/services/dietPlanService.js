const env = require("../config/env");
const llmService = require("./llmService");
const { MEALS, MEAL_TIMINGS } = require("../constants/meals");

const DAYS_OF_WEEK = Object.freeze([
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
]);

const BUDGET_TOLERANCE = 0.10;


/* =========================================================
   ALLERGY NORMALIZATION
========================================================= */

const ALLERGY_ALIASES = Object.freeze({
  brocolli: "broccoli",
  broccoli: "broccoli",

  tomatos: "tomato",
  tomatoes: "tomato",
  tomato: "tomato",

  peanute: "peanut",
  peanutes: "peanut",
  peanut: "peanut",
  peanuts: "peanut",

  milk: "milk",
  dairy: "dairy",

  egg: "egg",
  eggs: "egg",

  gluten: "gluten",

  soy: "soy",
  soya: "soy",

  fish: "fish",

  shrimp: "shellfish",
  prawns: "shellfish",
  prawn: "shellfish",
  shellfish: "shellfish",
});

function normalizeAllergies(allergies) {
  if (!Array.isArray(allergies)) {
    return [];
  }

  return [
    ...new Set(
      allergies
        .map((allergy) =>
          String(allergy || "")
            .toLowerCase()
            .trim()
        )
        .filter(Boolean)
        .map(
          (allergy) =>
            ALLERGY_ALIASES[allergy] || allergy
        )
    ),
  ];
}


/* =========================================================
   ALLERGY CHECK
========================================================= */

function hasAllergen(meal, allergies) {
  const normalizedAllergies =
    normalizeAllergies(allergies);

  if (!normalizedAllergies.length) {
    return false;
  }

  const mealAllergens =
    Array.isArray(meal?.allergens)
      ? meal.allergens.map((allergen) =>
          String(allergen || "")
            .toLowerCase()
            .trim()
        )
      : [];

  const ingredients =
    Array.isArray(meal?.ingredients)
      ? meal.ingredients.map((ingredient) =>
          String(ingredient || "")
            .toLowerCase()
            .trim()
        )
      : [];

  const searchableText = [
    meal?.name || "",
    meal?.description || "",
    ...ingredients,
  ]
    .join(" ")
    .toLowerCase();

  return normalizedAllergies.some((allergy) => {
    return (
      searchableText.includes(allergy) ||
      mealAllergens.includes(allergy)
    );
  });
}


/* =========================================================
   DIET PREFERENCE CHECK
========================================================= */

const NON_VEGETARIAN_TERMS = Object.freeze([
  "chicken",
  "mutton",
  "beef",
  "pork",
  "lamb",
  "turkey",
  "bacon",
  "ham",
  "sausage",
  "meat",
  "fish",
  "salmon",
  "tuna",
  "sardine",
  "anchovy",
  "prawn",
  "prawns",
  "shrimp",
  "shellfish",
  "crab",
  "lobster",
  "seafood",
  "egg",
  "eggs",
  "omelette",
  "omelet",
]);

function getMealSearchText(meal) {
  const ingredients =
    Array.isArray(meal?.ingredients)
      ? meal.ingredients
      : [];

  return [
    meal?.name || "",
    meal?.description || "",
    ...ingredients,
  ]
    .join(" ")
    .toLowerCase();
}

function hasDietViolation(
  meal,
  dietPreference
) {
  if (
    dietPreference !== "vegetarian"
  ) {
    return false;
  }

  const text =
    getMealSearchText(meal);

  return NON_VEGETARIAN_TERMS.some(
    (term) =>
      text.includes(term)
  );
}

function mealIsAllowed(
  meal,
  allergies,
  dietPreference
) {
  return (
    !hasAllergen(
      meal,
      allergies
    ) &&
    !hasDietViolation(
      meal,
      dietPreference
    )
  );
}


/* =========================================================
   CALORIE MATCH
========================================================= */

function mealMatchesTarget(
  meal,
  calorieTarget
) {
  const lower =
    calorieTarget *
    (1 - BUDGET_TOLERANCE);

  const upper =
    calorieTarget *
    (1 + BUDGET_TOLERANCE);

  return (
    meal.calories >= lower &&
    meal.calories <= upper
  );
}


/* =========================================================
   SELECT MEALS
========================================================= */

function selectMealsForDay(
  calorieTarget,
  dailyBudget,
  allergies,
  dietPreference
) {
  const availableMeals =
    MEALS.filter((meal) =>
      mealIsAllowed(
        meal,
        allergies,
        dietPreference
      )
    );

  if (!availableMeals.length) {
    throw new Error(
      "No meals are available for the selected diet preference and allergies."
    );
  }

  const selected = [];

  for (const timing of MEAL_TIMINGS) {

    const suitable =
      availableMeals.filter(
        (meal) =>
          !selected.some(
            (selectedMeal) =>
              selectedMeal.name ===
              meal.name
          ) &&
          mealMatchesTarget(
            meal,
            calorieTarget /
              MEAL_TIMINGS.length
          )
      );

    let chosen;

    if (suitable.length > 0) {
      chosen =
        suitable[
          Math.floor(
            Math.random() *
              suitable.length
          )
        ];
    } else {

      const fallback =
        availableMeals.filter(
          (meal) =>
            !selected.some(
              (selectedMeal) =>
                selectedMeal.name ===
                meal.name
            )
        );

      chosen =
        fallback.length > 0
          ? fallback[
              Math.floor(
                Math.random() *
                  fallback.length
              )
            ]
          : availableMeals[0];
    }

    selected.push({
      timing,
      name: chosen.name,
      description: chosen.description,
      calories: chosen.calories,
      protein_grams: chosen.protein,
      carbs_grams: chosen.carbs,
      fat_grams: chosen.fat,
      ingredients: [],
    });
  }

  selected.totalCalories =
    selected.reduce(
      (sum, meal) =>
        sum + meal.calories,
      0
    );

  selected.dailyBudget =
    dailyBudget;

  return selected;
}


/* =========================================================
   VARIETY CHECK
========================================================= */

function checkMealVariety(weeklyPlan) {
  const mealNamesByDay =
    weeklyPlan.map((day) =>
      (day.meals || []).map(
        (meal) => meal.name
      )
    );

  for (
    let i = 1;
    i < mealNamesByDay.length;
    i++
  ) {
    const prev =
      mealNamesByDay[i - 1];

    const curr =
      mealNamesByDay[i];

    for (
      let j = 0;
      j < prev.length;
      j++
    ) {
      if (
        prev[j] === curr[j] &&
        prev[j + 1] === curr[j + 1]
      ) {
        return {
          valid: false,
          dayIndex: i,
          message:
            `Consecutive days ${DAYS_OF_WEEK[i - 1]} and ${DAYS_OF_WEEK[i]} share consecutive meals`,
        };
      }
    }
  }

  return {
    valid: true,
  };
}


/* =========================================================
   RULE-BASED PLAN
========================================================= */

function generateRuleBasedPlan(
  profile,
  calculation,
  allergies,
  budget
) {
  const fitnessGoal =
    calculation.fitness_goal ||
    profile.fitness_goal;

  const dietPreference =
    profile.diet_preference ||
    "vegetarian";

  const dailyBudget =
    budget
      ? Math.round(budget / 30)
      : null;

  const availableMeals =
    MEALS.filter((meal) =>
      mealIsAllowed(
        meal,
        allergies,
        dietPreference
      )
    );

  if (!availableMeals.length) {
    throw new Error(
      "No meals are available for the selected diet preference and allergies."
    );
  }

  const weeklyPlan =
    DAYS_OF_WEEK.map(
      (day, dayIndex) => {

        const meals = [];

        for (
          const timing of MEAL_TIMINGS
        ) {

          const perMealTarget =
            calculation.calorie_target /
            MEAL_TIMINGS.length;

          const suitable =
            availableMeals.filter(
              (meal) =>
                !meals.some(
                  (selected) =>
                    selected.name ===
                    meal.name
                ) &&
                mealMatchesTarget(
                  meal,
                  perMealTarget
                )
            );

          let chosen;

          if (suitable.length > 0) {

            chosen =
              suitable[
                (dayIndex +
                  MEAL_TIMINGS.length) %
                  suitable.length
              ];

          } else {

            const fallback =
              availableMeals.filter(
                (meal) =>
                  !meals.some(
                    (selected) =>
                      selected.name ===
                      meal.name
                  )
              );

            chosen =
              fallback.length > 0
                ? fallback[
                    (dayIndex +
                      meals.length) %
                      fallback.length
                  ]
                : availableMeals[
                    dayIndex %
                      availableMeals.length
                  ];
          }

          meals.push({
            name: chosen.name,
            description:
              chosen.description,
            calories:
              chosen.calories,
            protein_grams:
              chosen.protein,
            carbs_grams:
              chosen.carbs,
            fat_grams:
              chosen.fat,
            ingredients: [],
          });
        }

        return {
          day,
          meals,
        };
      }
    );

  return {
    type: "rule_based",

    disclaimer:
      "This is a rule-based diet plan generated as a fallback. For AI-generated personalized plans, configure LLM_API_KEY.",

    calorie_target:
      Math.round(
        calculation.calorie_target
      ),

    protein_grams:
      Math.round(
        calculation.protein_grams
      ),

    carbs_grams:
      Math.round(
        calculation.carbs_grams
      ),

    fat_grams:
      Math.round(
        calculation.fat_grams
      ),

    fitness_goal:
      fitnessGoal,

    diet_preference:
      dietPreference,

    daily_budget:
      dailyBudget,

    weekly_plan:
      weeklyPlan,

    generated_via:
      "rule_based",
  };
}


/* =========================================================
   VALIDATE AI PLAN
========================================================= */

function validateLlmDietPlan(
  plan,
  calculation,
  allergies,
  budget,
  dietPreference = "vegetarian"
) {
  const errors = [];

  if (
    !plan ||
    typeof plan !== "object"
  ) {
    errors.push(
      "Invalid plan structure"
    );

    return {
      valid: false,
      errors,
    };
  }

  if (
    !Array.isArray(
      plan.weekly_plan
    )
  ) {
    errors.push(
      "Missing weekly_plan array"
    );

    return {
      valid: false,
      errors,
    };
  }

  const normalizedAllergies =
    normalizeAllergies(
      allergies
    );

  for (
    let dayIdx = 0;
    dayIdx < plan.weekly_plan.length;
    dayIdx++
  ) {

    const day =
      plan.weekly_plan[dayIdx];

    if (
      !day.meals ||
      !Array.isArray(day.meals)
    ) {
      errors.push(
        `Day ${dayIdx} missing meals array`
      );

      continue;
    }

    for (
      let mealIdx = 0;
      mealIdx < day.meals.length;
      mealIdx++
    ) {

      const meal =
        day.meals[mealIdx];

      if (
        !meal.name ||
        typeof meal.name !==
          "string"
      ) {
        errors.push(
          `Day ${dayIdx} meal ${mealIdx}: missing name`
        );
      }

      if (
        !Number.isFinite(
          meal.calories
        ) ||
        meal.calories <= 0
      ) {
        errors.push(
          `Day ${dayIdx} meal ${mealIdx}: invalid calories`
        );
      }

      if (
        !Number.isFinite(
          meal.protein_grams
        ) ||
        meal.protein_grams < 0
      ) {
        errors.push(
          `Day ${dayIdx} meal ${mealIdx}: invalid protein_grams`
        );
      }

      if (
        !Number.isFinite(
          meal.carbs_grams
        ) ||
        meal.carbs_grams < 0
      ) {
        errors.push(
          `Day ${dayIdx} meal ${mealIdx}: invalid carbs_grams`
        );
      }

      if (
        !Number.isFinite(
          meal.fat_grams
        ) ||
        meal.fat_grams < 0
      ) {
        errors.push(
          `Day ${dayIdx} meal ${mealIdx}: invalid fat_grams`
        );
      }

      /* Allergy validation */
      if (
        hasAllergen(
          meal,
          normalizedAllergies
        )
      ) {
        errors.push(
          `Day ${dayIdx} meal ${mealIdx}: contains a restricted food`
        );
      }

      /* Vegetarian validation */
      if (
        hasDietViolation(
          meal,
          dietPreference
        )
      ) {
        errors.push(
          `Day ${dayIdx} meal ${mealIdx}: violates the selected diet preference`
        );
      }
    }
  }

  const variety =
    checkMealVariety(
      plan.weekly_plan
    );

  if (!variety.valid) {
    errors.push(
      "Meal variety check failed: " +
        variety.message
    );
  }

  return {
    valid:
      errors.length === 0,
    errors,
  };
}


/* =========================================================
   MAIN GENERATOR
========================================================= */

async function generateDietPlan(
  profile,
  calculation,
  options = {}
) {
  let allergies = [];

  try {

    allergies =
      Array.isArray(
        profile.allergies
      )
        ? profile.allergies
        : JSON.parse(
            profile.allergies ||
              "[]"
          );

  } catch {
    allergies = [];
  }

  allergies =
    normalizeAllergies(
      allergies
    );

  const budget =
    profile.monthly_diet_budget;

  const dietPreference =
    profile.diet_preference ||
    "vegetarian";


  /* =======================================================
     AI GENERATION
  ======================================================= */

  if (
    llmService.isConfigured() &&
    !options.forceRuleBased
  ) {

    try {

      const prompt =
        llmService.buildDietPlanPrompt(
          profile,
          calculation,
          allergies,
          budget,
          calculation.fitness_goal ||
            profile.fitness_goal
        );

      const rawContent =
        await llmService.callLLM(
          prompt,
          {
            temperature: 0.7,
          }
        );

      const parsed =
        await llmService.parseLlmJson(
          rawContent
        );

      const validated =
        validateLlmDietPlan(
          parsed,
          calculation,
          allergies,
          budget,
          dietPreference
        );

      if (validated.valid) {

        return {
          plan: {
            type:
              "ai_generated",

            disclaimer:
              "This diet plan was AI-generated. Consult a healthcare professional before making dietary changes.",

            calorie_target:
              Math.round(
                calculation.calorie_target
              ),

            protein_grams:
              Math.round(
                calculation.protein_grams
              ),

            carbs_grams:
              Math.round(
                calculation.carbs_grams
              ),

            fat_grams:
              Math.round(
                calculation.fat_grams
              ),

            fitness_goal:
              calculation.fitness_goal ||
              profile.fitness_goal,

            diet_preference:
              dietPreference,

            daily_budget:
              budget
                ? Math.round(
                    budget / 30
                  )
                : null,

            weekly_plan:
              parsed.weekly_plan,

            generated_via:
              "llm",

            model:
              env.llmModel,
          },

          source:
            "llm",
        };
      }

      console.warn(
        "LLM diet plan failed validation, falling back to rule-based:",
        validated.errors
      );

      return {
        plan:
          generateRuleBasedPlan(
            profile,
            calculation,
            allergies,
            budget
          ),

        source:
          "rule_based_fallback",

        validationErrors:
          validated.errors,
      };

    } catch (err) {

      console.error(
        "LLM diet plan generation failed, falling back to rule-based:",
        err.message
      );

      return {
        plan:
          generateRuleBasedPlan(
            profile,
            calculation,
            allergies,
            budget
          ),

        source:
          "rule_based_fallback",

        error:
          err.message,
      };
    }
  }


  /* =======================================================
     RULE-BASED GENERATION
  ======================================================= */

  return {
    plan:
      generateRuleBasedPlan(
        profile,
        calculation,
        allergies,
        budget
      ),

    source:
      "rule_based",
  };
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  generateDietPlan,
  generateRuleBasedPlan,
  validateLlmDietPlan,
  checkMealVariety,
  hasAllergen,
  hasDietViolation,
  normalizeAllergies,
  DAYS_OF_WEEK,
};