const { calculateBMR, calculateTDEE, calculateCalorieTarget, calculateMacros, calculateAll } = require("../src/services/calculationService");
const { calculateFlags } = require("../src/controllers/profileController");

describe("Calculation Service", () => {
  describe("calculateBMR", () => {
    test("male profile - Mifflin-St Jeor", () => {
      const profile = { gender: "male", weight: 76, height: 180, age: 25 };
      const bmr = calculateBMR(profile);
      expect(bmr).toBe(Math.round(10 * 76 + 6.25 * 180 - 5 * 25 + 5));
      expect(bmr).toBe(1765);
    });

    test("female profile - Mifflin-St Jeor", () => {
      const profile = { gender: "female", weight: 60, height: 165, age: 22 };
      const bmr = calculateBMR(profile);
      expect(bmr).toBe(Math.round(10 * 60 + 6.25 * 165 - 5 * 22 - 161));
      expect(bmr).toBe(1360);
    });

    test("other gender throws error", () => {
      const profile = { gender: "other", weight: 60, height: 165, age: 22 };
      expect(() => calculateBMR(profile)).toThrow("No BMR formula available");
    });

    test("invalid weight throws error", () => {
      const profile = { gender: "male", weight: 0, height: 180, age: 25 };
      expect(() => calculateBMR(profile)).toThrow("Invalid weight");
    });

    test("negative weight throws error", () => {
      const profile = { gender: "male", weight: -10, height: 180, age: 25 };
      expect(() => calculateBMR(profile)).toThrow("Invalid weight");
    });

    test("NaN weight throws error", () => {
      const profile = { gender: "male", weight: NaN, height: 180, age: 25 };
      expect(() => calculateBMR(profile)).toThrow("Invalid weight");
    });

    test("Infinity weight throws error", () => {
      const profile = { gender: "male", weight: Infinity, height: 180, age: 25 };
      expect(() => calculateBMR(profile)).toThrow("Invalid weight");
    });

    test("missing gender throws error", () => {
      const profile = { gender: "unknown", weight: 70, height: 170, age: 25 };
      expect(() => calculateBMR(profile)).toThrow("No BMR formula available");
    });
  });

  describe("calculateTDEE", () => {
    test("sedentary", () => {
      const tdee = calculateTDEE(1750, "sedentary");
      expect(tdee).toBe(Math.round(1750 * 1.20));
      expect(tdee).toBe(2100);
    });

    test("light", () => {
      const tdee = calculateTDEE(1750, "light");
      expect(tdee).toBe(Math.round(1750 * 1.375));
      expect(tdee).toBe(2406);
    });

    test("moderate", () => {
      const tdee = calculateTDEE(1750, "moderate");
      expect(tdee).toBe(Math.round(1750 * 1.55));
      expect(tdee).toBe(2713);
    });

    test("active", () => {
      const tdee = calculateTDEE(1750, "active");
      expect(tdee).toBe(Math.round(1750 * 1.725));
      expect(tdee).toBe(3019);
    });

    test("very_active", () => {
      const tdee = calculateTDEE(1750, "very_active");
      expect(tdee).toBe(Math.round(1750 * 1.90));
      expect(tdee).toBe(3325);
    });

    test("invalid activity level throws error", () => {
      expect(() => calculateTDEE(1750, "invalid")).toThrow("Invalid activity level");
    });
  });

  describe("calculateCalorieTarget", () => {
    test("cut - 20% deficit", () => {
      const target = calculateCalorieTarget(2713, "cut");
      expect(target).toBe(Math.round(2713 * 0.80));
      expect(target).toBe(2170);
    });

    test("bulk - 10% surplus", () => {
      const target = calculateCalorieTarget(2713, "bulk");
      expect(target).toBe(Math.round(2713 * 1.10));
      expect(target).toBe(2984);
    });

    test("maintain - 0% adjustment", () => {
      const target = calculateCalorieTarget(2713, "maintain");
      expect(target).toBe(2713);
    });

    test("recomp - 5% deficit", () => {
      const target = calculateCalorieTarget(2713, "recomp");
      expect(target).toBe(Math.round(2713 * 0.95));
      expect(target).toBe(2577);
    });

    test("invalid fitness goal throws error", () => {
      expect(() => calculateCalorieTarget(2713, "invalid")).toThrow("Invalid fitness goal");
    });
  });

  describe("calculateMacros", () => {
    test("cut macros", () => {
      const macros = calculateMacros(2170, "cut");
      expect(macros.protein_grams).toBe(Math.round((2170 * 0.35) / 4));
      expect(macros.carbs_grams).toBe(Math.round((2170 * 0.40) / 4));
      expect(macros.fat_grams).toBe(Math.round((2170 * 0.25) / 9));
    });

    test("bulk macros", () => {
      const macros = calculateMacros(2984, "bulk");
      expect(macros.protein_grams).toBe(Math.round((2984 * 0.30) / 4));
      expect(macros.carbs_grams).toBe(Math.round((2984 * 0.45) / 4));
      expect(macros.fat_grams).toBe(Math.round((2984 * 0.25) / 9));
    });

    test("maintain macros", () => {
      const macros = calculateMacros(2713, "maintain");
      expect(macros.protein_grams).toBe(Math.round((2713 * 0.30) / 4));
      expect(macros.carbs_grams).toBe(Math.round((2713 * 0.45) / 4));
      expect(macros.fat_grams).toBe(Math.round((2713 * 0.25) / 9));
    });

    test("recomp macros", () => {
      const macros = calculateMacros(2577, "recomp");
      expect(macros.protein_grams).toBe(Math.round((2577 * 0.35) / 4));
      expect(macros.carbs_grams).toBe(Math.round((2577 * 0.40) / 4));
      expect(macros.fat_grams).toBe(Math.round((2577 * 0.25) / 9));
    });

    test("macro calories approximately equal calorie target", () => {
      const target = 2984;
      const macros = calculateMacros(target, "bulk");
      const proteinCals = macros.protein_grams * 4;
      const carbCals = macros.carbs_grams * 4;
      const fatCals = macros.fat_grams * 9;
      const totalCals = proteinCals + carbCals + fatCals;
      expect(Math.abs(totalCals - target)).toBeLessThanOrEqual(9);
    });

    test("negative calorie target throws error", () => {
      expect(() => calculateMacros(-100, "cut")).toThrow("Invalid calorie target");
    });

    test("zero calorie target throws error", () => {
      expect(() => calculateMacros(0, "cut")).toThrow("Invalid calorie target");
    });
  });

  describe("calculateAll", () => {
    test("complete calculation for male bulk profile", () => {
      const profile = { gender: "male", weight: 71, height: 175, age: 21, activity_level: "moderate", fitness_goal: "bulk" };
      const result = calculateAll(profile);
      expect(result.bmr).toBe(Math.round(10 * 71 + 6.25 * 175 - 5 * 21 + 5));
      expect(result.tdee).toBe(Math.round(result.bmr * 1.55));
      expect(result.calorie_target).toBe(Math.round(result.tdee * 1.10));
      expect(result.protein_grams).toBeGreaterThan(0);
      expect(result.carbs_grams).toBeGreaterThan(0);
      expect(result.fat_grams).toBeGreaterThan(0);
      expect(result.fitness_goal).toBe("bulk");
      expect(result.activity_level).toBe("moderate");
    });

    test("complete calculation carries fitness_goal and activity_level", () => {
      const profile = { gender: "male", weight: 70, height: 170, age: 25, activity_level: "light", fitness_goal: "cut" };
      const result = calculateAll(profile);
      expect(result.fitness_goal).toBe("cut");
      expect(result.activity_level).toBe("light");
    });

    test("complete calculation for female cut profile", () => {
      const profile = { gender: "female", weight: 60, height: 165, age: 22, activity_level: "light", fitness_goal: "cut" };
      const result = calculateAll(profile);
      expect(result.bmr).toBeGreaterThan(0);
      expect(result.tdee).toBeGreaterThan(0);
      expect(result.calorie_target).toBeGreaterThan(0);
    });

    test("calculateAll with invalid activity level throws", () => {
      const profile = { gender: "male", weight: 70, height: 170, age: 25, activity_level: "invalid", fitness_goal: "cut" };
      expect(() => calculateAll(profile)).toThrow();
    });

    test("calculateAll with invalid fitness goal throws", () => {
      const profile = { gender: "male", weight: 70, height: 170, age: 25, activity_level: "moderate", fitness_goal: "invalid" };
      expect(() => calculateAll(profile)).toThrow();
    });
  });

  describe("calculateFlags", () => {
    test("no changes returns all zeros", () => {
      const existing = { gender: "male", age: 25, height: 180, weight: 76, activity_level: "moderate", fitness_goal: "maintain" };
      const flags = calculateFlags(existing, { ...existing });
      expect(flags.needs_calorie_recalculation).toBe(0);
      expect(flags.needs_diet_regeneration).toBe(0);
      expect(flags.needs_gym_regeneration).toBe(0);
      expect(flags.needs_schedule_regeneration).toBe(0);
    });

    test("weight change triggers calorie recalc", () => {
      const existing = { gender: "male", age: 25, height: 180, weight: 76, activity_level: "moderate", fitness_goal: "maintain" };
      const flags = calculateFlags(existing, { ...existing, weight: 80 });
      expect(flags.needs_calorie_recalculation).toBe(1);
    });

    test("age change triggers calorie recalc", () => {
      const existing = { gender: "male", age: 25, height: 180, weight: 76, activity_level: "moderate", fitness_goal: "maintain" };
      const flags = calculateFlags(existing, { ...existing, age: 26 });
      expect(flags.needs_calorie_recalculation).toBe(1);
    });

    test("height change triggers calorie recalc", () => {
      const existing = { gender: "male", age: 25, height: 180, weight: 76, activity_level: "moderate", fitness_goal: "maintain" };
      const flags = calculateFlags(existing, { ...existing, height: 185 });
      expect(flags.needs_calorie_recalculation).toBe(1);
    });

    test("gender change triggers calorie recalc", () => {
      const existing = { gender: "male", age: 25, height: 180, weight: 76, activity_level: "moderate", fitness_goal: "maintain" };
      const flags = calculateFlags(existing, { ...existing, gender: "female" });
      expect(flags.needs_calorie_recalculation).toBe(1);
    });

    test("activity_level change triggers calorie recalc", () => {
      const existing = { gender: "male", age: 25, height: 180, weight: 76, activity_level: "moderate", fitness_goal: "maintain" };
      const flags = calculateFlags(existing, { ...existing, activity_level: "active" });
      expect(flags.needs_calorie_recalculation).toBe(1);
    });

    test("fitness_goal change triggers calorie recalc", () => {
      const existing = { gender: "male", age: 25, height: 180, weight: 76, activity_level: "moderate", fitness_goal: "maintain" };
      const flags = calculateFlags(existing, { ...existing, fitness_goal: "cut" });
      expect(flags.needs_calorie_recalculation).toBe(1);
    });

    test("allergies change does NOT trigger calorie recalc", () => {
      const existing = { gender: "male", age: 25, height: 180, weight: 76, activity_level: "moderate", fitness_goal: "maintain" };
      const flags = calculateFlags(existing, { ...existing, allergies: '["peanuts"]' });
      expect(flags.needs_calorie_recalculation).toBe(0);
    });

    test("injuries change does NOT trigger calorie recalc", () => {
      const existing = { gender: "male", age: 25, height: 180, weight: 76, activity_level: "moderate", fitness_goal: "maintain" };
      const flags = calculateFlags(existing, { ...existing, injuries: '[]' });
      expect(flags.needs_calorie_recalculation).toBe(0);
    });

    test("monthly_diet_budget change does NOT trigger calorie recalc", () => {
      const existing = { gender: "male", age: 25, height: 180, weight: 76, activity_level: "moderate", fitness_goal: "maintain", monthly_diet_budget: 300 };
      const flags = calculateFlags(existing, { ...existing, monthly_diet_budget: 500 });
      expect(flags.needs_calorie_recalculation).toBe(0);
    });

    test("target_body_description change does NOT trigger calorie recalc", () => {
      const existing = { gender: "male", age: 25, height: 180, weight: 76, activity_level: "moderate", fitness_goal: "maintain" };
      const flags = calculateFlags(existing, { ...existing, target_body_description: "new desc" });
      expect(flags.needs_calorie_recalculation).toBe(0);
    });

    test("college timing changes do NOT trigger calorie recalc", () => {
      const existing = { gender: "male", age: 25, height: 180, weight: 76, activity_level: "moderate", fitness_goal: "maintain", college_start_time: "09:00", college_end_time: "17:00", college_days: '[]' };
      const flags = calculateFlags(existing, { ...existing, college_start_time: "10:00" });
      expect(flags.needs_calorie_recalculation).toBe(0);
    });
  });
});
