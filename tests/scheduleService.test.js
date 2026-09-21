const {
  generateSchedule,
  parseTime,
  isCollegeDay,
  getDietMealTiming,
} = require("../src/services/scheduleService");
const { WEEKDAYS, WEEKENDS } = require("../src/services/scheduleService");

describe("Schedule Service", () => {
  describe("parseTime", () => {
    test("parses valid 24-hour time", () => {
      expect(parseTime("09:00")).toEqual({ hours: 9, minutes: 0, totalMinutes: 540 });
    });

    test("parses valid time with minutes", () => {
      expect(parseTime("17:30")).toEqual({ hours: 17, minutes: 30, totalMinutes: 1050 });
    });

    test("parses leading zero hours", () => {
      expect(parseTime("08:45")).toEqual({ hours: 8, minutes: 45, totalMinutes: 525 });
    });

    test("parses single digit hour", () => {
      expect(parseTime("9:00")).toEqual({ hours: 9, minutes: 0, totalMinutes: 540 });
    });

    test("returns null for invalid time format", () => {
      expect(parseTime("25:00")).toBeNull();
      expect(parseTime("abc")).toBeNull();
      expect(parseTime(null)).toBeNull();
      expect(parseTime(undefined)).toBeNull();
      expect(parseTime("")).toBeNull();
      expect(parseTime("09:60")).toBeNull();
      expect(parseTime("9:0")).toBeNull();
    });
  });

  describe("isCollegeDay", () => {
    test("returns true for day in college_days", () => {
      expect(isCollegeDay(["Mon", "Wed", "Fri"], "Mon")).toBe(true);
    });

    test("returns false for day not in college_days", () => {
      expect(isCollegeDay(["Mon", "Wed", "Fri"], "Tue")).toBe(false);
    });

    test("returns false for empty college_days", () => {
      expect(isCollegeDay([], "Mon")).toBe(false);
    });

    test("returns false for null/undefined", () => {
      expect(isCollegeDay(null, "Mon")).toBe(false);
      expect(isCollegeDay(undefined, "Mon")).toBe(false);
    });

    test("returns false for invalid day", () => {
      expect(isCollegeDay(["Mon"], "InvalidDay")).toBe(false);
    });
  });

  describe("getDietMealTiming", () => {
    test("returns pre_college for early morning", () => {
      expect(getDietMealTiming(7, "09:00", "17:00")).toBe("pre_college");
    });

    test("returns during_college for mid-morning", () => {
      expect(getDietMealTiming(12, "09:00", "17:00")).toBe("during_college");
    });

    test("returns post_college for evening", () => {
      expect(getDietMealTiming(18, "09:00", "17:00")).toBe("post_college");
    });

    test("uses default timing when no college times", () => {
      expect(getDietMealTiming(8, null, null)).toBe("breakfast");
    });

    test("uses default timing for evening without college", () => {
      expect(getDietMealTiming(20, null, null)).toBe("dinner");
    });

    test("uses default timing for late night", () => {
      expect(getDietMealTiming(23, null, null)).toBe("late_night");
    });
  });

  describe("generateSchedule", () => {
    const baseProfile = {
      college_start_time: "09:00",
      college_end_time: "17:00",
      college_days: JSON.stringify(["Mon", "Tue", "Wed", "Thu", "Fri"]),
      gym_experience_level: "beginner",
      fitness_goal: "bulk",
      gender: "male",
      age: 25,
      height: 180,
      weight: 76,
      activity_level: "moderate",
      monthly_diet_budget: 300,
      allergies: JSON.stringify([]),
      injuries: JSON.stringify([]),
      target_body_description: "",
      gym_experience_note: "",
    };

    test("generates schedule for all 7 days", () => {
      const schedule = generateSchedule(baseProfile, null, null);
      expect(schedule.weekly_schedule).toBeDefined();
      expect(Object.keys(schedule.weekly_schedule).length).toBe(7);
    });

    test("marks college days correctly", () => {
      const schedule = generateSchedule(baseProfile, null, null);
      expect(schedule.weekly_schedule["Mon"].is_college_day).toBe(true);
      expect(schedule.weekly_schedule["Sat"].is_college_day).toBe(false);
      expect(schedule.weekly_schedule["Sun"].is_college_day).toBe(false);
    });

    test("includes college hours when set", () => {
      const schedule = generateSchedule(baseProfile, null, null);
      expect(schedule.weekly_schedule["Mon"].college_hours).toBe("09:00 - 17:00");
    });

    test("handles no college days", () => {
      const profile = { ...baseProfile, college_days: JSON.stringify([]), college_start_time: null, college_end_time: null };
      const schedule = generateSchedule(profile, null, null);
      expect(schedule.weekly_schedule["Mon"].is_college_day).toBe(false);
      expect(schedule.weekly_schedule["Mon"].college_hours).toBe(null);
    });

    test("includes meals from diet plan when provided", () => {
      const dietPlan = {
        weekly_plan: [
          { day: "Mon", meals: [{ name: "Breakfast", calories: 500 }] },
          { day: "Tue", meals: [{ name: "Lunch", calories: 600 }] },
          { day: "Wed", meals: [{ name: "Dinner", calories: 700 }] },
          { day: "Thu", meals: [{ name: "Snack", calories: 300 }] },
          { day: "Fri", meals: [{ name: "Meal5", calories: 500 }] },
          { day: "Sat", meals: [{ name: "Meal6", calories: 500 }] },
          { day: "Sun", meals: [{ name: "Meal7", calories: 500 }] },
        ],
      };
      const schedule = generateSchedule(baseProfile, dietPlan, null);
      expect(schedule.weekly_schedule["Mon"].meals).toHaveLength(1);
      expect(schedule.weekly_schedule["Mon"].meals[0].name).toBe("Breakfast");
    });

    test("includes workouts from gym plan when provided", () => {
      const gymPlan = {
        weekly_plan: [
          { day: "Mon", focus: "push", exercises: [{ name: "Push-ups", sets: 3, reps: "10-15" }] },
          ...Array(6).fill().map((_, i) => ({
            day: ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
            focus: "rest",
            exercises: [{ name: "Rest", sets: 1, reps: "5 min" }],
          })),
        ],
      };
      const schedule = generateSchedule(baseProfile, null, gymPlan);
      expect(schedule.weekly_schedule["Mon"].workouts).toHaveLength(1);
      expect(schedule.weekly_schedule["Mon"].workouts[0].name).toBe("Push-ups");
    });

    test("includes disclaimer", () => {
      const schedule = generateSchedule(baseProfile, null, null);
      expect(schedule.disclaimer).toBeDefined();
    });

    test("handles malformed JSON gracefully", () => {
      const profile = { ...baseProfile, college_days: "invalid json", allergies: "invalid json", injuries: "invalid json" };
      const schedule = generateSchedule(profile, null, null);
      expect(schedule).toBeDefined();
      expect(schedule.weekly_schedule).toBeDefined();
    });

    test("handles null diet and gym plans", () => {
      const schedule = generateSchedule(baseProfile, null, null);
      expect(schedule.weekly_schedule["Mon"].meals).toEqual([]);
      expect(schedule.weekly_schedule["Mon"].workouts).toEqual([]);
    });

    test("includes profile_info", () => {
      const schedule = generateSchedule(baseProfile, null, null);
      expect(schedule.profile_info).toBeDefined();
      expect(schedule.profile_info.fitness_goal).toBe("bulk");
      expect(schedule.profile_info.gym_experience_level).toBe("beginner");
    });

    test("WEEKDAYS and WEEKENDS are correct", () => {
      expect(WEEKDAYS).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
      expect(WEEKENDS).toEqual(["Sat", "Sun"]);
    });

    test("does not report conflict between college and meal overlapping in time", () => {
      const dietPlan = {
        weekly_plan: [
          { day: "Mon", meals: [{ name: "Lunch", timing: "lunch" }] },
        ],
      };
      // College from 09:00 to 15:00, lunch is generated at 13:00 (overlapping)
      const profile = { ...baseProfile, college_start_time: "09:00", college_end_time: "15:00", college_days: JSON.stringify(["Mon"]) };
      const schedule = generateSchedule(profile, dietPlan, null);
      
      expect(schedule.weekly_schedule["Mon"].conflicts).toEqual([]);
      expect(schedule.weekly_schedule["Mon"].has_conflicts).toBe(false);
    });
  });
});
