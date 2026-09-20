const { setupTestDb, teardownTestDb } = require("./setup");
const { getDb } = require("../src/config/database");
const {
  ValidationError,
  validateWeekStart,
  validateSummaryRange,
  getWeeklyAdherence,
  getAdherenceSummary,
  findApplicablePlan,
  planCoversDay,
  countMealCompletions,
  countWorkoutCompletions,
  startOfUTCMonday,
  getElapsedDayStrings,
  formatDate,
} = require("../src/services/adherenceService");

const DAYS = Object.freeze(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
const GYM_FOCUSES = Object.freeze({
  Mon: "push", Tue: "pull", Wed: "legs", Thu: "push", Fri: "pull", Sat: "cardio", Sun: "rest",
});

let testDb;
let userIdA;
let userIdB;

beforeAll(() => {
  testDb = setupTestDb();
  const db = getDb();
  const resA = db
    .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
    .run("Adherence A", "adha@test.com", "hash");
  userIdA = resA.lastInsertRowid;
  const resB = db
    .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
    .run("Adherence B", "adhb@test.com", "hash");
  userIdB = resB.lastInsertRowid;
});

afterAll(() => {
  teardownTestDb();
});

beforeEach(() => {
  const db = getDb();
  db.exec("DELETE FROM progress_logs");
  db.exec("DELETE FROM diet_plans");
  db.exec("DELETE FROM gym_plans");
});

function dietPlanJson(mealsPerDay) {
  return {
    weekly_plan: DAYS.map((day) => ({
      day,
      meals: Array.from({ length: mealsPerDay }, (_, i) => ({
        name: `Meal_${day}_${i}`,
        calories: 500,
      })),
    })),
  };
}

function gymPlanJson() {
  return {
    weekly_plan: DAYS.map((day) => ({
      day,
      focus: GYM_FOCUSES[day],
      exercises: [{ name: `Exercise_${day}`, sets: 3 }],
    })),
  };
}

function insertDietPlan(db, userId, plan, generatedAt, validUntil) {
  return db
    .prepare(
      "INSERT INTO diet_plans (user_id, meals_json, generated_at, valid_until) VALUES (?, ?, ?, ?)"
    )
    .run(userId, JSON.stringify(plan), generatedAt, validUntil);
}

function insertGymPlan(db, userId, plan, generatedAt, validUntil) {
  return db
    .prepare(
      "INSERT INTO gym_plans (user_id, workouts_json, generated_at, valid_until) VALUES (?, ?, ?, ?)"
    )
    .run(userId, JSON.stringify(plan), generatedAt, validUntil);
}

function insertMealLog(db, userId, loggedAt, valueJson = {}) {
  return db
    .prepare(
      "INSERT INTO progress_logs (user_id, log_type, value_json, logged_at) VALUES (?, ?, ?, ?)"
    )
    .run(userId, "meal_compliance", JSON.stringify(valueJson), loggedAt);
}

function insertWorkoutLog(db, userId, loggedAt, valueJson = { workout_completed: true }) {
  return db
    .prepare(
      "INSERT INTO progress_logs (user_id, log_type, value_json, logged_at) VALUES (?, ?, ?, ?)"
    )
    .run(userId, "workout_completion", JSON.stringify(valueJson), loggedAt);
}

function weekDaysFrom(mondayDateStr) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayDateStr + "T00:00:00.000Z");
    d.setUTCDate(d.getUTCDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

describe("Adherence Service - Validation helpers", () => {
  describe("validateWeekStart", () => {
    test("returns valid for undefined (current week)", () => {
      expect(validateWeekStart(undefined)).toEqual({ valid: true });
    });

    test("returns valid for a Monday", () => {
      expect(validateWeekStart("2024-01-15").valid).toBe(true);
    });

    test("returns valid for a future Monday", () => {
      expect(validateWeekStart("2025-12-01").valid).toBe(true);
    });

    test("returns invalid for a non-Monday (Tuesday)", () => {
      const result = validateWeekStart("2024-01-16");
      expect(result.valid).toBe(false);
      expect(result.fields.week_start).toBeDefined();
    });

    test("returns invalid for a non-Monday (Sunday)", () => {
      expect(validateWeekStart("2024-01-21").valid).toBe(false);
    });

    test("returns invalid for a non-ISO format", () => {
      const result = validateWeekStart("01-15-2024");
      expect(result.valid).toBe(false);
    });

    test("returns invalid for a short-format date", () => {
      const result = validateWeekStart("2024-1-5");
      expect(result.valid).toBe(false);
    });

    test("returns invalid for a non-date string", () => {
      const result = validateWeekStart("not-a-date");
      expect(result.valid).toBe(false);
    });

    test("returns invalid for an impossible calendar date (Feb 30)", () => {
      const result = validateWeekStart("2024-02-30");
      expect(result.valid).toBe(false);
    });

    test("returns invalid for an impossible month (13-45)", () => {
      const result = validateWeekStart("2024-13-45");
      expect(result.valid).toBe(false);
    });
  });

  describe("Timezone boundaries (IST)", () => {
    test("startOfUTCMonday converts early UTC Monday to previous IST week (Sunday)", () => {
      // 03:00 UTC Monday is 08:30 AM IST Monday. It should fall in current Monday week.
      const date1 = new Date("2024-02-05T03:00:00.000Z");
      const mon1 = startOfUTCMonday(date1);
      expect(mon1.toISOString()).toBe("2024-02-04T18:30:00.000Z"); // Midnight IST on Monday 5th Feb

      // 22:00 UTC Sunday is 03:30 AM IST Monday. It should fall in Monday week.
      const date2 = new Date("2024-02-04T22:00:00.000Z");
      const mon2 = startOfUTCMonday(date2);
      expect(mon2.toISOString()).toBe("2024-02-04T18:30:00.000Z");

      // 18:00 UTC Sunday is 23:30 PM IST Sunday. It should fall in PREVIOUS Monday week.
      const date3 = new Date("2024-02-04T18:00:00.000Z");
      const mon3 = startOfUTCMonday(date3);
      expect(mon3.toISOString()).toBe("2024-01-28T18:30:00.000Z"); // Monday Jan 29
    });

    test("getElapsedDayStrings calculates days correctly with IST midnight boundaries", () => {
      // Monday 5th Feb 2024 at 18:30:00 UTC = 00:00:00 IST Feb 6th (Tuesday)
      // The days covered for the week starting Feb 5th should be [Feb 5, Feb 6] since the current time is exactly the start of Tuesday.
      const weekStart = "2024-02-05";
      const nowAtMidnightTuesdayIST = new Date("2024-02-05T18:30:00.000Z");
      
      const startMondayStr = formatDate(startOfUTCMonday(new Date("2024-02-05T05:00:00Z")));
      const nowStr = formatDate(nowAtMidnightTuesdayIST);
      const days = getElapsedDayStrings(startMondayStr, nowStr);
      
      expect(days).toEqual(["2024-02-05", "2024-02-06"]);
    });

    test("getElapsedDayStrings stops exactly at 7 days for a completed week", () => {
      const weekStart = "2024-02-05";
      const nowNextWeekWednesday = new Date("2024-02-14T05:00:00.000Z"); // Way past the week
      
      const startMondayStr = formatDate(startOfUTCMonday(new Date("2024-02-05T05:00:00Z")));
      const nowStr = formatDate(nowNextWeekWednesday);
      const days = getElapsedDayStrings(startMondayStr, nowStr);
      
      expect(days.length).toBe(7);
      expect(days[0]).toBe("2024-02-05");
      expect(days[6]).toBe("2024-02-11");
    });
  });

  describe("validateSummaryRange", () => {
    test("returns default 4 for undefined", () => {
      expect(validateSummaryRange(undefined)).toEqual({ valid: true, range: 4 });
    });

    test("returns valid with range 4 for 4", () => {
      expect(validateSummaryRange(4)).toEqual({ valid: true, range: 4 });
    });

    test("returns valid with range 8 for 8", () => {
      expect(validateSummaryRange(8)).toEqual({ valid: true, range: 8 });
    });

    test("returns valid with range 12 for 12", () => {
      expect(validateSummaryRange(12)).toEqual({ valid: true, range: 12 });
    });

    test("accepts string '8'", () => {
      expect(validateSummaryRange("8")).toEqual({ valid: true, range: 8 });
    });

    test("returns invalid for 5", () => {
      expect(validateSummaryRange(5).valid).toBe(false);
    });

    test("returns invalid for 0", () => {
      expect(validateSummaryRange(0).valid).toBe(false);
    });

    test("returns invalid for 13", () => {
      expect(validateSummaryRange(13).valid).toBe(false);
    });

    test("returns invalid for -1", () => {
      expect(validateSummaryRange(-1).valid).toBe(false);
    });

    test("returns invalid for 'abc'", () => {
      expect(validateSummaryRange("abc").valid).toBe(false);
    });

    test("returns invalid for null", () => {
      expect(validateSummaryRange(null).valid).toBe(false);
    });
  });

  describe("meal completion counting", () => {
    test("returns 0 for empty logs", () => {
      expect(countMealCompletions([])).toBe(0);
    });

    test("counts one meal per log without meals_hit", () => {
      const logs = [{ value_json: {} }, { value_json: { note: "x" } }];
      expect(countMealCompletions(logs)).toBe(2);
    });

    test("sums meals_hit when present", () => {
      const logs = [
        { value_json: { meals_hit: 3 } },
        { value_json: { meals_hit: 4 } },
      ];
      expect(countMealCompletions(logs)).toBe(7);
    });

    test("treats non-numeric meals_hit as 1", () => {
      const logs = [{ value_json: { meals_hit: "lots" } }];
      expect(countMealCompletions(logs)).toBe(1);
    });
  });

  describe("workout completion counting", () => {
    test("returns 0 for empty logs", () => {
      expect(countWorkoutCompletions([])).toBe(0);
    });

    test("counts one workout per log without workouts_hit", () => {
      const logs = [{ value_json: { completed: true } }, { value_json: {} }];
      expect(countWorkoutCompletions(logs)).toBe(2);
    });

    test("sums workouts_hit when present", () => {
      const logs = [
        { value_json: { workouts_hit: 2 } },
        { value_json: { workouts_hit: 1 } },
      ];
      expect(countWorkoutCompletions(logs)).toBe(3);
    });
  });
});

describe("Adherence Service - Plan applicability", () => {
  const plan1 = { id: 1, generated_at: "2024-01-15T00:00:00.000Z", valid_until: "2024-01-22T00:00:00.000Z" };
  const plan2 = { id: 2, generated_at: "2024-01-17T00:00:00.000Z", valid_until: "2024-01-24T00:00:00.000Z" };

  test("planCoversDay returns true for a day within validity", () => {
    expect(planCoversDay(plan1, "2024-01-17")).toBe(true);
  });

  test("planCoversDay returns false for a day before generated_at", () => {
    expect(planCoversDay(plan1, "2024-01-14")).toBe(false);
  });

  test("planCoversDay returns false on valid_until day (exclusive)", () => {
    expect(planCoversDay(plan1, "2024-01-22")).toBe(false);
  });

  test("planCoversDay returns true with null valid_until after generated_at", () => {
    const p = { id: 3, generated_at: "2024-01-15T00:00:00.000Z", valid_until: null };
    expect(planCoversDay(p, "2024-02-01")).toBe(true);
  });

  test("planCoversDay returns false when generated_at missing", () => {
    expect(planCoversDay({ valid_until: "2024-01-22T00:00:00.000Z" }, "2024-01-17")).toBe(false);
  });

  test("findApplicablePlan returns the latest applicable plan", () => {
    expect(findApplicablePlan([plan1, plan2], "2024-01-17").id).toBe(2);
    expect(findApplicablePlan([plan1, plan2], "2024-01-15").id).toBe(1);
  });

  test("findApplicablePlan returns null when no plan covers the day", () => {
    expect(findApplicablePlan([plan1], "2024-01-23")).toBeNull();
  });
});

describe("Adherence Service - Weekly adherence", () => {
  describe("Current week (partial)", () => {
    const now = "2024-01-17T12:00:00.000Z"; // Wednesday Jan 17 2024
    const dietPlan = dietPlanJson(4);
    const gymPlan = gymPlanJson();

    beforeEach(() => {
      insertDietPlan(testDb, userIdA, dietPlan, "2024-01-15T00:00:00.000Z", "2024-01-22T00:00:00.000Z");
      insertGymPlan(testDb, userIdA, gymPlan, "2024-01-15T00:00:00.000Z", "2024-01-22T00:00:00.000Z");
      insertMealLog(testDb, userIdA, "2024-01-15T08:00:00.000Z");
      insertMealLog(testDb, userIdA, "2024-01-16T08:00:00.000Z");
      insertMealLog(testDb, userIdA, "2024-01-17T08:00:00.000Z");
      insertWorkoutLog(testDb, userIdA, "2024-01-17T18:00:00.000Z");
    });

    test("computes current week boundaries and partial flag", async () => {
      const result = await getWeeklyAdherence(userIdA, { week_start: undefined, now });
      expect(result.data.week_start).toBe("2024-01-15");
      expect(result.data.week_end).toBe("2024-01-21");
      expect(result.data.days_in_period).toBe(3);
      expect(result.data.is_partial_week).toBe(true);
    });

    test("computes diet adherence at 25% (3 of 12 meals)", async () => {
      const result = await getWeeklyAdherence(userIdA, { week_start: undefined, now });
      expect(result.data.diet.adherence_percentage).toBe(25);
      expect(result.data.diet.meals_hit).toBe(3);
      expect(result.data.diet.meals_missed).toBe(9);
      expect(result.data.diet.meals_expected).toBe(12);
      expect(result.data.diet.message).toBeNull();
    });

    test("computes gym adherence at 33.33% (1 of 3 workouts)", async () => {
      const result = await getWeeklyAdherence(userIdA, { week_start: undefined, now });
      expect(result.data.gym.adherence_percentage).toBe(33.33);
      expect(result.data.gym.workouts_completed).toBe(1);
      expect(result.data.gym.workouts_missed).toBe(2);
      expect(result.data.gym.workouts_expected).toBe(3);
    });

    test("computes overall adherence (4 of 15 = 26.67%)", async () => {
      const result = await getWeeklyAdherence(userIdA, { week_start: undefined, now });
      expect(result.data.overall.overall_adherence_percentage).toBe(26.67);
    });

    test("accepts a Date object for now", async () => {
      const result = await getWeeklyAdherence(userIdA, { week_start: undefined, now: new Date(now) });
      expect(result.data.week_start).toBe("2024-01-15");
      expect(result.data.diet.adherence_percentage).toBe(25);
    });
  });

  describe("Specified full week", () => {
    const now = "2024-02-05T12:00:00.000Z"; // Monday Feb 5 (after target week)
    const weekStart = "2024-01-29";
    const dietPlan = dietPlanJson(4);
    const gymPlan = gymPlanJson();

    beforeEach(() => {
      insertDietPlan(testDb, userIdA, dietPlan, "2024-01-29T00:00:00.000Z", "2024-02-12T00:00:00.000Z");
      insertGymPlan(testDb, userIdA, gymPlan, "2024-01-29T00:00:00.000Z", "2024-02-12T00:00:00.000Z");
    });

    test("returns 100% adherence when all meals and workouts logged", async () => {
      const days = weekDaysFrom(weekStart);
      days.forEach((d, i) => {
        insertMealLog(testDb, userIdA, `${d}T08:00:00.000Z`, { meals_hit: 4 });
        if (d !== days[6]) {
          insertWorkoutLog(testDb, userIdA, `${d}T18:00:00.000Z`);
        }
      });

      const result = await getWeeklyAdherence(userIdA, { week_start: weekStart, now });
      expect(result.data.is_partial_week).toBe(false);
      expect(result.data.days_in_period).toBe(7);
      expect(result.data.diet.adherence_percentage).toBe(100);
      expect(result.data.diet.meals_hit).toBe(28);
      expect(result.data.diet.meals_missed).toBe(0);
      expect(result.data.gym.adherence_percentage).toBe(100);
      expect(result.data.gym.workouts_completed).toBe(6);
      expect(result.data.gym.workouts_missed).toBe(0);
      expect(result.data.overall.overall_adherence_percentage).toBe(100);
    });

    test("returns 0% adherence (zero data) when no logs exist", async () => {
      const result = await getWeeklyAdherence(userIdA, { week_start: weekStart, now });
      expect(result.data.diet.adherence_percentage).toBe(0);
      expect(result.data.diet.meals_hit).toBe(0);
      expect(result.data.diet.meals_missed).toBe(28);
      expect(result.data.gym.adherence_percentage).toBe(0);
      expect(result.data.gym.workouts_missed).toBe(6);
      expect(result.data.overall.overall_adherence_percentage).toBe(0);
    });

    test("respects meals_hit field in meal_compliance logs", async () => {
      const days = weekDaysFrom(weekStart);
      days.forEach((d) => {
        insertMealLog(testDb, userIdA, `${d}T08:00:00.000Z`, { meals_hit: 2 });
      });
      const result = await getWeeklyAdherence(userIdA, { week_start: weekStart, now });
      expect(result.data.diet.meals_hit).toBe(14);
      expect(result.data.diet.adherence_percentage).toBe(50);
    });

    test("clamps adherence to 100% when logs exceed expected", async () => {
      const days = weekDaysFrom(weekStart);
      days.forEach((d) => {
        insertMealLog(testDb, userIdA, `${d}T08:00:00.000Z`, { meals_hit: 6 });
        insertWorkoutLog(testDb, userIdA, `${d}T18:00:00.000Z`);
      });
      const result = await getWeeklyAdherence(userIdA, { week_start: weekStart, now });
      expect(result.data.diet.adherence_percentage).toBe(100);
      expect(result.data.diet.meals_missed).toBe(0);
      expect(result.data.gym.workouts_missed).toBe(0);
    });
  });

  describe("Plan change during the week", () => {
    const now = "2024-02-05T12:00:00.000Z";
    const weekStart = "2024-01-29";

    test("uses the latest applicable plan per day", async () => {
      const planV1 = dietPlanJson(4);
      const planV2 = dietPlanJson(2);

      insertDietPlan(testDb, userIdA, planV1, "2024-01-29T00:00:00.000Z", "2024-02-12T00:00:00.000Z");
      insertDietPlan(testDb, userIdA, planV2, "2024-02-02T00:00:00.000Z", "2024-02-16T00:00:00.000Z");

      const result = await getWeeklyAdherence(userIdA, { week_start: weekStart, now });

      const planRows = testDb
        .prepare("SELECT meals_json FROM diet_plans WHERE user_id = ? ORDER BY id ASC")
        .all(userIdA);
      const v1 = JSON.parse(planRows[0].meals_json);
      const v2 = JSON.parse(planRows[1].meals_json);
      expect(v1.weekly_plan.length).toBe(7);
      expect(v2.weekly_plan.length).toBe(7);

      // Mon-Thu (Jan 29-31, Feb 1) => planV1 (4 meals/day) = 16
      // Fri-Sun (Feb 2-4) => planV2 (2 meals/day) = 6  => total 22
      expect(result.data.diet.meals_expected).toBe(22);
    });

    test("gym plan change uses latest applicable plan", async () => {
      const gymV1 = gymPlanJson();
      const gymV2 = gymPlanJson();
      insertGymPlan(testDb, userIdA, gymV1, "2024-01-29T00:00:00.000Z", "2024-02-12T00:00:00.000Z");
      insertGymPlan(testDb, userIdA, gymV2, "2024-02-02T00:00:00.000Z", "2024-02-16T00:00:00.000Z");

      const result = await getWeeklyAdherence(userIdA, { week_start: weekStart, now });
      // All 6 non-rest days still covered by latest applicable plan => 6 expected
      expect(result.data.gym.workouts_expected).toBe(6);
    });
  });

  describe("Edge cases", () => {
    test("no diet plan returns null diet adherence with message", async () => {
      const now = "2024-02-05T12:00:00.000Z";
      insertGymPlan(testDb, userIdA, gymPlanJson(), "2024-01-29T00:00:00.000Z", "2024-02-12T00:00:00.000Z");
      const result = await getWeeklyAdherence(userIdA, { week_start: "2024-01-29", now });
      expect(result.data.diet.adherence_percentage).toBeNull();
      expect(result.data.diet.message).toMatch(/No diet plan/);
      expect(result.data.diet.meals_expected).toBe(0);
    });

    test("no gym plan returns null gym adherence with message", async () => {
      const now = "2024-02-05T12:00:00.000Z";
      insertDietPlan(testDb, userIdA, dietPlanJson(4), "2024-01-29T00:00:00.000Z", "2024-02-12T00:00:00.000Z");
      const result = await getWeeklyAdherence(userIdA, { week_start: "2024-01-29", now });
      expect(result.data.gym.adherence_percentage).toBeNull();
      expect(result.data.gym.message).toMatch(/No gym plan/);
      expect(result.data.gym.workouts_expected).toBe(0);
    });

    test("no plans at all returns null overall", async () => {
      const now = "2024-02-05T12:00:00.000Z";
      const result = await getWeeklyAdherence(userIdA, { week_start: "2024-01-29", now });
      expect(result.data.diet.adherence_percentage).toBeNull();
      expect(result.data.gym.adherence_percentage).toBeNull();
      expect(result.data.overall.overall_adherence_percentage).toBeNull();
      expect(result.data.overall.message).toMatch(/no diet or gym plan/);
    });

    test("no progress logs returns valid zero adherence", async () => {
      const now = "2024-02-05T12:00:00.000Z";
      insertDietPlan(testDb, userIdA, dietPlanJson(4), "2024-01-29T00:00:00.000Z", "2024-02-12T00:00:00.000Z");
      insertGymPlan(testDb, userIdA, gymPlanJson(), "2024-01-29T00:00:00.000Z", "2024-02-12T00:00:00.000Z");
      const result = await getWeeklyAdherence(userIdA, { week_start: "2024-01-29", now });
      expect(result.data.diet.adherence_percentage).toBe(0);
      expect(result.data.gym.adherence_percentage).toBe(0);
      expect(result.data.diet.meals_hit).toBe(0);
      expect(result.data.gym.workouts_completed).toBe(0);
    });

    test("throws ValidationError for a non-Monday week_start", async () => {
      await expect(getWeeklyAdherence(userIdA, { week_start: "2024-01-16", now: "2024-01-17T12:00:00.000Z" })).rejects.toThrow(ValidationError);
    });

    test("throws ValidationError for an invalid date string", async () => {
      await expect(getWeeklyAdherence(userIdA, { week_start: "not-a-date" })).rejects.toThrow(ValidationError);
    });

    test("throws ValidationError for an impossible calendar date", async () => {
      await expect(getWeeklyAdherence(userIdA, { week_start: "2024-02-30" })).rejects.toThrow(ValidationError);
    });
  });

  describe("User isolation", () => {
    const now = "2024-02-05T12:00:00.000Z";
    const weekStart = "2024-01-29";
    const days = weekDaysFrom(weekStart);

    test("each user only sees their own adherence data", async () => {
      insertDietPlan(testDb, userIdA, dietPlanJson(4), "2024-01-29T00:00:00.000Z", "2024-02-12T00:00:00.000Z");
      insertDietPlan(testDb, userIdB, dietPlanJson(4), "2024-01-29T00:00:00.000Z", "2024-02-12T00:00:00.000Z");

      // Only user A logs compliance
      days.forEach((d) => insertMealLog(testDb, userIdA, `${d}T08:00:00.000Z`, { meals_hit: 4 }));

      const resA = await getWeeklyAdherence(userIdA, { week_start: weekStart, now });
      const resB = await getWeeklyAdherence(userIdB, { week_start: weekStart, now });

      expect(resA.data.diet.meals_hit).toBe(28);
      expect(resA.data.diet.adherence_percentage).toBe(100);
      expect(resB.data.diet.meals_hit).toBe(0);
      expect(resB.data.diet.adherence_percentage).toBe(0);
    });
  });
});

describe("Adherence Service - Summary", () => {
  const now = "2024-02-05T12:00:00.000Z"; // Monday
  const dietPlan = dietPlanJson(4);
  const gymPlan = gymPlanJson();

  beforeEach(() => {
    insertDietPlan(testDb, userIdA, dietPlan, "2024-01-01T00:00:00.000Z", "2024-03-01T00:00:00.000Z");
    insertGymPlan(testDb, userIdA, gymPlan, "2024-01-01T00:00:00.000Z", "2024-03-01T00:00:00.000Z");
  });

  test("returns a 4-week summary by default", async () => {
    const result = await getAdherenceSummary(userIdA, { now });
    expect(result.data.range_weeks).toBe(4);
    expect(result.data.weeks.length).toBe(4);
    expect(result.data.averages).toBeDefined();
  });

  test("returns an 8-week summary", async () => {
    const result = await getAdherenceSummary(userIdA, { weeks: 8, now });
    expect(result.data.range_weeks).toBe(8);
    expect(result.data.weeks.length).toBe(8);
  });

  test("returns a 12-week summary", async () => {
    const result = await getAdherenceSummary(userIdA, { weeks: 12, now });
    expect(result.data.range_weeks).toBe(12);
    expect(result.data.weeks.length).toBe(12);
  });

  test("computes averages across weeks", async () => {
    // Current week (Feb 5, Monday) -> 1 elapsed day; log 2 meals + 1 workout
    insertMealLog(testDb, userIdA, "2024-02-05T08:00:00.000Z", { meals_hit: 2 });
    insertMealLog(testDb, userIdA, "2024-02-05T12:00:00.000Z", { meals_hit: 2 });
    insertWorkoutLog(testDb, userIdA, "2024-02-05T18:00:00.000Z");
    // One past week (Jan 15) -> log full compliance (Mon-Sun meals; Mon-Sat workouts, Sun is rest)
    ["2024-01-15", "2024-01-16", "2024-01-17", "2024-01-18", "2024-01-19", "2024-01-20", "2024-01-21"].forEach((d, i) => {
      insertMealLog(testDb, userIdA, `${d}T08:00:00.000Z`, { meals_hit: 4 });
      if (i < 6) insertWorkoutLog(testDb, userIdA, `${d}T18:00:00.000Z`);
    });

    const result = await getAdherenceSummary(userIdA, { weeks: 4, now });
    const weeks = result.data.weeks;
    // Most recent current week should be first computed at index 3 (chronological)
    const current = weeks.find((w) => w.week_start === "2024-02-05");
    expect(current).toBeDefined();
    expect(current.diet_adherence_percentage).toBe(100);
    expect(current.gym_adherence_percentage).toBe(100);

    const jan15 = weeks.find((w) => w.week_start === "2024-01-15");
    expect(jan15.diet_adherence_percentage).toBe(100);
    expect(jan15.gym_adherence_percentage).toBe(100);

    expect(typeof result.data.averages.overall_adherence_percentage).toBe("number");
  });

  test("returns null averages when no plans exist", async () => {
    const db = getDb();
    db.exec("DELETE FROM diet_plans");
    db.exec("DELETE FROM gym_plans");
    const result = await getAdherenceSummary(userIdA, { weeks: 4, now });
    expect(result.data.averages.overall_adherence_percentage).toBeNull();
    expect(result.data.averages.diet_adherence_percentage).toBeNull();
    expect(result.data.averages.gym_adherence_percentage).toBeNull();
  });

  test("throws ValidationError for an invalid range", async () => {
    await expect(getAdherenceSummary(userIdA, { weeks: 5, now })).rejects.toThrow(ValidationError);
  });

  test("throws ValidationError for a non-numeric range", async () => {
    await expect(getAdherenceSummary(userIdA, { weeks: "abc", now })).rejects.toThrow(ValidationError);
  });
});
