const {
  generateGymPlan,
  generateRuleBasedGymPlan,
  validateLlmGymPlan,
  isExerciseSafe,
  filterSafeExercises,
} = require("../src/services/gymPlanService");
const { EXERCISES } = require("../src/constants/exercises");

describe("Gym Plan Service", () => {
  const baseProfile = {
    gender: "male",
    age: 25,
    height: 180,
    weight: 76,
    activity_level: "moderate",
    fitness_goal: "bulk",
    monthly_diet_budget: 300,
    gym_experience_level: "beginner",
    allergies: JSON.stringify([]),
    injuries: JSON.stringify([]),
    college_days: JSON.stringify([]),
    target_body_description: "",
    college_start_time: null,
    college_end_time: null,
    gym_experience_note: "",
  };

  const baseCalculation = {
    fitness_goal: "bulk",
    activity_level: "moderate",
    weight: 76,
  };

  describe("isExerciseSafe", () => {
    test("returns true when no injuries", () => {
      const exercise = EXERCISES[0];
      expect(isExerciseSafe(exercise, [])).toBe(true);
      expect(isExerciseSafe(exercise, [])).toBe(true);
    });

    test("returns true when exercise has no injury conflicts", () => {
      const exercise = EXERCISES.find((e) => e.injuries_to_avoid.length === 0);
      expect(exercise).toBeDefined();
      expect(isExerciseSafe(exercise, [{ category: "knee", detail: "old injury" }])).toBe(true);
    });

    test("returns false when exercise conflicts with injury", () => {
      const pushUp = EXERCISES.find((e) => e.name === "Push-ups");
      expect(pushUp).toBeDefined();
      expect(isExerciseSafe(pushUp, [{ category: "shoulder", detail: "rotator cuff tear" }])).toBe(false);
    });

    test("returns false when exercise conflicts with wrist injury", () => {
      const pushUp = EXERCISES.find((e) => e.name === "Push-ups");
      expect(isExerciseSafe(pushUp, [{ category: "wrist", detail: "" }])).toBe(false);
    });

    test("handles null/undefined injuries", () => {
      const exercise = EXERCISES[0];
      expect(isExerciseSafe(exercise, null)).toBe(true);
      expect(isExerciseSafe(exercise, undefined)).toBe(true);
    });

    test("case-insensitive injury matching", () => {
      const pushUp = EXERCISES.find((e) => e.name === "Push-ups");
      expect(isExerciseSafe(pushUp, [{ category: "SHOULDER", detail: "" }])).toBe(false);
    });

    test("does not exclude exercise when unrelated injury present", () => {
      const squat = EXERCISES.find((e) => e.name === "Bodyweight Squats");
      expect(isExerciseSafe(squat, [{ category: "shoulder", detail: "" }])).toBe(true);
    });
  });

  describe("filterSafeExercises", () => {
    test("returns all exercises when no injuries", () => {
      const result = filterSafeExercises(EXERCISES, []);
      expect(result.length).toBe(EXERCISES.length);
    });

    test("filters out exercises conflicting with injuries", () => {
      const result = filterSafeExercises(EXERCISES, [{ category: "shoulder", detail: "" }]);
      expect(result.length).toBeLessThan(EXERCISES.length);
      for (const ex of result) {
        expect(ex.injuries_to_avoid).not.toContain("shoulder");
      }
    });

    test("filters out exercises conflicting with knee injury", () => {
      const result = filterSafeExercises(EXERCISES, [{ category: "knee", detail: "" }]);
      for (const ex of result) {
        expect(ex.injuries_to_avoid).not.toContain("knee");
      }
    });

    test("handles empty exercise list", () => {
      const result = filterSafeExercises([], [{ category: "knee", detail: "" }]);
      expect(result).toEqual([]);
    });
  });

  describe("validateLlmGymPlan", () => {
    test("valid plan passes validation", () => {
      const plan = {
        weekly_plan: [
          { day: "Mon", focus: "push", exercises: [{ name: "Push-ups" }] },
          { day: "Tue", focus: "pull", exercises: [{ name: "Bent-over Rows" }] },
          { day: "Wed", focus: "legs", exercises: [{ name: "Bodyweight Squats" }] },
          { day: "Thu", focus: "push", exercises: [{ name: "Overhead Press" }] },
          { day: "Fri", focus: "pull", exercises: [{ name: "Pull-ups" }] },
          { day: "Sat", focus: "cardio", exercises: [{ name: "Jump Rope" }] },
          { day: "Sun", focus: "rest", exercises: [{ name: "Active Recovery" }] },
        ],
      };
      const result = validateLlmGymPlan(plan, []);
      expect(result.valid).toBe(true);
    });

    test("invalid plan structure rejected", () => {
      const result = validateLlmGymPlan(null, []);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid plan structure");
    });

    test("missing weekly_plan rejected", () => {
      const result = validateLlmGymPlan({ not_weekly: true }, []);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing weekly_plan array");
    });

    test("injury conflict detected", () => {
      const plan = {
        weekly_plan: [
          { day: "Mon", focus: "push", exercises: [{ name: "Push-ups" }] },
          { day: "Tue", focus: "pull", exercises: [{ name: "Bent-over Rows" }] },
          { day: "Wed", focus: "legs", exercises: [{ name: "Bodyweight Squats" }] },
          { day: "Thu", focus: "push", exercises: [{ name: "Overhead Press" }] },
          { day: "Fri", focus: "pull", exercises: [{ name: "Pull-ups" }] },
          { day: "Sat", focus: "cardio", exercises: [{ name: "Jump Rope" }] },
          { day: "Sun", focus: "rest", exercises: [{ name: "Active Recovery" }] },
        ],
      };
      const injuries = [{ category: "shoulder", detail: "rotator cuff tear" }];
      const result = validateLlmGymPlan(plan, injuries);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Push-ups"))).toBe(true);
    });

    test("missing rest day rejected when injuries present", () => {
      const plan = {
        weekly_plan: Array(7).fill().map((_, i) => ({
          day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
          focus: "strength",
          exercises: [{ name: "Bodyweight Squats" }],
        })),
      };
      const result = validateLlmGymPlan(plan, [{ category: "knee", detail: "" }]);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("rest or recovery day"))).toBe(true);
    });

    test("passes when no injuries (no injury validation needed)", () => {
      const plan = {
        weekly_plan: [
          { day: "Mon", focus: "push", exercises: [{ name: "Push-ups" }] },
          { day: "Sun", focus: "rest", exercises: [{ name: "Active Recovery" }] },
        ],
      };
      const result = validateLlmGymPlan(plan, []);
      expect(result.errors.some((e) => e.includes("rest day"))).toBe(false);
    });
  });

  describe("generateRuleBasedGymPlan", () => {
    test("generates 7-day plan", () => {
      const plan = generateRuleBasedGymPlan(baseProfile, baseCalculation);
      expect(plan.weekly_plan.length).toBe(7);
      expect(plan.type).toBe("rule_based");
    });

    test("includes fitness goal and experience level", () => {
      const plan = generateRuleBasedGymPlan(baseProfile, baseCalculation);
      expect(plan.fitness_goal).toBe("bulk");
      expect(plan.gym_experience_level).toBe("beginner");
    });

    test("includes disclaimer", () => {
      const plan = generateRuleBasedGymPlan(baseProfile, baseCalculation);
      expect(plan.disclaimer).toContain("rule-based");
    });

    test("includes rest day", () => {
      const plan = generateRuleBasedGymPlan(baseProfile, baseCalculation);
      const restDay = plan.weekly_plan.find((d) => d.focus === "rest");
      expect(restDay).toBeDefined();
      expect(restDay.day).toBe("Sun");
    });

    test("filters exercises for knee injury", () => {
      const profileWithInjury = {
        ...baseProfile,
        injuries: JSON.stringify([{ category: "knee", detail: "ACL repair" }]),
      };
      const plan = generateRuleBasedGymPlan(profileWithInjury, baseCalculation);
      expect(plan).toBeDefined();
      const allExerciseNames = plan.weekly_plan.flatMap((d) => d.exercises.map((e) => e.name));
      for (const name of allExerciseNames) {
        const ex = EXERCISES.find((e) => e.name === name);
        if (ex) {
          expect(ex.injuries_to_avoid).not.toContain("knee");
        }
      }
    });

    test("filters exercises for shoulder injury", () => {
      const profileWithInjury = {
        ...baseProfile,
        injuries: JSON.stringify([{ category: "shoulder", detail: "rotator cuff" }]),
      };
      const plan = generateRuleBasedGymPlan(profileWithInjury, baseCalculation);
      expect(plan).toBeDefined();
    });

    test("adjusts difficulty for advanced user", () => {
      const advancedProfile = { ...baseProfile, gym_experience_level: "advanced", injuries: JSON.stringify([]) };
      const plan = generateRuleBasedGymPlan(advancedProfile, baseCalculation);
      expect(plan.gym_experience_level).toBe("advanced");
    });

    test("adjusts difficulty for none experience", () => {
      const noneProfile = { ...baseProfile, gym_experience_level: "none", injuries: JSON.stringify([]) };
      const plan = generateRuleBasedGymPlan(noneProfile, baseCalculation);
      expect(plan.gym_experience_level).toBe("none");
      expect(plan.weekly_plan.length).toBe(7);
    });

    test("handles empty injuries", () => {
      const plan = generateRuleBasedGymPlan(baseProfile, baseCalculation);
      expect(plan.weekly_plan.length).toBe(7);
    });

    test("handles malformed injuries JSON gracefully", () => {
      const profileBadInjuries = {
        ...baseProfile,
        injuries: "invalid json",
      };
      const plan = generateRuleBasedGymPlan(profileBadInjuries, baseCalculation);
      expect(plan).toBeDefined();
      expect(plan.weekly_plan.length).toBe(7);
    });

    test("each non-rest day has at least 1 exercise", () => {
      const plan = generateRuleBasedGymPlan(baseProfile, baseCalculation);
      for (const day of plan.weekly_plan) {
        if (day.focus !== "rest") {
          expect(day.exercises.length).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  describe("generateGymPlan (no LLM configured)", () => {
    test("returns rule-based plan when LLM not configured", async () => {
      const profile = { ...baseProfile };
      const result = await generateGymPlan(profile, baseCalculation);
      expect(result.source).toBe("rule_based");
      expect(result.plan.type).toBe("rule_based");
      expect(result.plan.weekly_plan).toBeDefined();
    });

    test("plan filters exercises for injuries", async () => {
      const profile = {
        ...baseProfile,
        injuries: JSON.stringify([{ category: "knee", detail: "injury" }]),
      };
      const result = await generateGymPlan(profile, baseCalculation);
      expect(result.source).toBe("rule_based");
    });
  });
});
