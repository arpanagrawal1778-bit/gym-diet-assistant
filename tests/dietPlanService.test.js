jest.mock("../src/services/llmService", () => {
  const actual = jest.requireActual("../src/services/llmService");
  return {
    ...actual,
    isConfigured: jest.fn(() => false),
    callLLM: jest.fn(() => Promise.reject(new Error("Mocked LLM error")))
  };
});
const {
  generateDietPlan,
  generateRuleBasedPlan,
  validateLlmDietPlan,
  checkMealVariety,
  hasAllergen,
} = require("../src/services/dietPlanService");
const { MEALS } = require("../src/constants/meals");

describe("Diet Plan Service", () => {
  const baseProfile = {
    gender: "male",
    age: 25,
    height: 180,
    weight: 76,
    activity_level: "moderate",
    fitness_goal: "bulk",
    monthly_diet_budget: 300,
    gym_experience_level: "beginner",
    allergies: [],
    injuries: [],
    college_days: [],
    target_body_description: "",
    college_start_time: null,
    college_end_time: null,
    gym_experience_note: "",
  };

  const baseCalculation = {
    bmr: 1765,
    tdee: 2736,
    calorie_target: 3010,
    protein_grams: 226,
    carbs_grams: 339,
    fat_grams: 83,
    fitness_goal: "bulk",
    activity_level: "moderate",
    weight: 76,
  };

  describe("hasAllergen", () => {
    test("returns false when no allergies", () => {
      const meal = MEALS[0];
      expect(hasAllergen(meal, [])).toBe(false);
      expect(hasAllergen(meal, [])).toBe(false);
    });

    test("returns true when meal contains allergen", () => {
      const mealWithDairy = MEALS.find((m) => m.allergens.includes("dairy"));
      expect(mealWithDairy).toBeDefined();
      expect(hasAllergen(mealWithDairy, ["dairy"])).toBe(true);
    });

    test("returns false when meal has no matching allergens", () => {
      const mealWithDairy = MEALS.find((m) => m.allergens.includes("dairy"));
      expect(hasAllergen(mealWithDairy, ["nuts"])).toBe(false);
    });

    test("handles 'none' allergen tag", () => {
      const meal = MEALS.find((m) => m.allergens.includes("none"));
      expect(meal).toBeDefined();
      expect(hasAllergen(meal, ["dairy", "nuts"])).toBe(false);
    });

    test("handles null/undefined allergies gracefully", () => {
      const meal = MEALS[0];
      expect(hasAllergen(meal, null)).toBe(false);
      expect(hasAllergen(meal, undefined)).toBe(false);
    });

    test("case-insensitive matching", () => {
      const mealWithDairy = MEALS.find((m) => m.allergens.includes("dairy"));
      expect(hasAllergen(mealWithDairy, ["DAIRY"])).toBe(true);
      expect(hasAllergen(mealWithDairy, ["Dairy"])).toBe(true);
    });
  });

  describe("checkMealVariety", () => {
    test("valid plan with no consecutive duplicate meals", () => {
      const weeklyPlan = [
        { day: "Mon", meals: [{ name: "A" }, { name: "B" }] },
        { day: "Tue", meals: [{ name: "C" }, { name: "D" }] },
        { day: "Wed", meals: [{ name: "E" }, { name: "F" }] },
      ];
      expect(checkMealVariety(weeklyPlan).valid).toBe(true);
    });

    test("detects consecutive duplicate meals", () => {
      const weeklyPlan = [
        { day: "Mon", meals: [{ name: "A" }, { name: "B" }] },
        { day: "Tue", meals: [{ name: "A" }, { name: "B" }] },
      ];
      const result = checkMealVariety(weeklyPlan);
      expect(result.valid).toBe(false);
      expect(result.message).toBeDefined();
    });

    test("passes when only first meal repeats but not consecutive", () => {
      const weeklyPlan = [
        { day: "Mon", meals: [{ name: "A" }, { name: "B" }] },
        { day: "Tue", meals: [{ name: "C" }, { name: "D" }] },
        { day: "Wed", meals: [{ name: "A" }, { name: "E" }] },
      ];
      expect(checkMealVariety(weeklyPlan).valid).toBe(true);
    });
  });

  describe("validateLlmDietPlan", () => {
    test("valid plan passes validation", () => {
      const plan = {
        weekly_plan: [
          {
            day: "Mon",
            meals: [
              { name: "Meal1", calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["rice"] },
              { name: "Meal2", calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["chicken"] },
              { name: "Meal3", calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["fish"] },
              { name: "Meal4", calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["veggies"] },
            ],
          },
          ...Array(6).fill().map((_, i) => ({
            day: ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
            meals: [
              { name: `Meal${i}1`, calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["rice"] },
              { name: `Meal${i}2`, calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["chicken"] },
              { name: `Meal${i}3`, calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["fish"] },
              { name: `Meal${i}4`, calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["veggies"] },
            ],
          })),
        ],
      };
      const result = validateLlmDietPlan(plan, baseCalculation, [], 300, "none");
      expect(result.valid).toBe(true);
    });

    test("invalid plan structure rejected", () => {
      const result = validateLlmDietPlan(null, baseCalculation, [], 300);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid plan structure");
    });

    test("missing weekly_plan rejected", () => {
      const result = validateLlmDietPlan({ not_weekly: true }, baseCalculation, [], 300);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing weekly_plan array");
    });

    test("allergen in ingredients rejected", () => {
      const plan = {
        weekly_plan: [
          {
            day: "Mon",
            meals: [
              { name: "Meal1", calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["peanuts"] },
              { name: "Meal2", calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["chicken"] },
              { name: "Meal3", calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["fish"] },
              { name: "Meal4", calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["veggies"] },
            ],
          },
        ],
      };
      const result = validateLlmDietPlan(plan, baseCalculation, ["peanuts"], 300, "none");
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("contains a restricted food"))).toBe(true);
    });

    test("negative calories rejected", () => {
      const plan = {
        weekly_plan: [
          {
            day: "Mon",
            meals: [
              { name: "Meal1", calories: -100, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["rice"] },
              { name: "Meal2", calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["chicken"] },
              { name: "Meal3", calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["fish"] },
              { name: "Meal4", calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["veggies"] },
            ],
          },
        ],
      };
      const result = validateLlmDietPlan(plan, baseCalculation, [], 300);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("calories"))).toBe(true);
    });

    test("NaN calories rejected", () => {
      const plan = {
        weekly_plan: [
          {
            day: "Mon",
            meals: [
              { name: "Meal1", calories: NaN, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["rice"] },
              { name: "Meal2", calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["chicken"] },
              { name: "Meal3", calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["fish"] },
              { name: "Meal4", calories: 700, protein_grams: 50, carbs_grams: 80, fat_grams: 20, ingredients: ["veggies"] },
            ],
          },
        ],
      };
      const result = validateLlmDietPlan(plan, baseCalculation, [], 300);
      expect(result.valid).toBe(false);
    });

    test("missing day meals rejected", () => {
      const plan = {
        weekly_plan: [
          { day: "Mon", notMeals: true },
        ],
      };
      const result = validateLlmDietPlan(plan, baseCalculation, [], 300);
      expect(result.valid).toBe(false);
    });
  });

  describe("generateRuleBasedPlan", () => {
    test("generates a 7-day plan with 4 meals per day", () => {
      const profile = { ...baseProfile, allergies: JSON.stringify([]), college_days: JSON.stringify([]) };
      const plan = generateRuleBasedPlan(profile, baseCalculation, [], 300);

      expect(plan.type).toBe("rule_based");
      expect(plan.weekly_plan).toBeDefined();
      expect(plan.weekly_plan.length).toBe(7);

      for (const day of plan.weekly_plan) {
        expect(day.meals).toBeDefined();
        expect(day.meals.length).toBe(4);
        for (const meal of day.meals) {
          expect(meal.calories).toBeGreaterThan(0);
          expect(meal.protein_grams).toBeGreaterThanOrEqual(0);
          expect(meal.carbs_grams).toBeGreaterThanOrEqual(0);
          expect(meal.fat_grams).toBeGreaterThanOrEqual(0);
        }
      }
    });

    test("respects budget calculation", () => {
      const profile = { ...baseProfile, allergies: JSON.stringify([]), college_days: JSON.stringify([]), monthly_diet_budget: 300 };
      const plan = generateRuleBasedPlan(profile, baseCalculation, [], 300);
      expect(plan.daily_budget).toBe(10);
    });

    test("includes fitness goal", () => {
      const profile = { ...baseProfile, allergies: JSON.stringify([]), college_days: JSON.stringify([]) };
      const plan = generateRuleBasedPlan(profile, baseCalculation, [], 300);
      expect(plan.fitness_goal).toBe("bulk");
    });

    test("includes disclaimer", () => {
      const profile = { ...baseProfile, allergies: JSON.stringify([]), college_days: JSON.stringify([]) };
      const plan = generateRuleBasedPlan(profile, baseCalculation, [], 300);
      expect(plan.disclaimer).toContain("rule-based");
    });

    test("includes calorie and macro targets", () => {
      const profile = { ...baseProfile, allergies: JSON.stringify([]), college_days: JSON.stringify([]) };
      const plan = generateRuleBasedPlan(profile, baseCalculation, [], 300);
      expect(plan.calorie_target).toBe(3010);
      expect(plan.protein_grams).toBe(226);
      expect(plan.carbs_grams).toBe(339);
      expect(plan.fat_grams).toBe(83);
    });
  });

  describe("generateDietPlan (no LLM configured)", () => {
    test("returns rule-based plan when LLM not configured", async () => {
      const profile = { ...baseProfile, allergies: JSON.stringify([]), college_days: JSON.stringify([]) };
      const result = await generateDietPlan(profile, baseCalculation);
      expect(result.source).toBe("rule_based");
      expect(result.plan.type).toBe("rule_based");
      expect(result.plan.weekly_plan).toBeDefined();
    });

    test("plan respects allergens in rule-based mode", async () => {
      const profile = { ...baseProfile, allergies: JSON.stringify(["dairy"]), college_days: JSON.stringify([]) };
      const result = await generateDietPlan(profile, baseCalculation);
      expect(result.source).toBe("rule_based");
      for (const day of result.plan.weekly_plan) {
        for (const meal of day.meals) {
          expect(meal.name).not.toBe("Greek Yogurt Bowl");
          expect(meal.name).not.toBe("Protein Oatmeal");
          expect(meal.name).not.toBe("Protein Pancakes");
        }
      }
    });

    test("plan with no allergies includes all meal options", async () => {
      const profile = { ...baseProfile, allergies: JSON.stringify([]), college_days: JSON.stringify([]) };
      const result = await generateDietPlan(profile, baseCalculation);
      expect(result.plan.weekly_plan.length).toBe(7);
    });

    test("handles empty allergies array", async () => {
      const profile = { ...baseProfile, allergies: JSON.stringify([]), college_days: JSON.stringify([]) };
      const result = await generateDietPlan(profile, baseCalculation);
      expect(result.source).toBe("rule_based");
    });
  });
});
