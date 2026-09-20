const { setupTestDb, teardownTestDb } = require("./setup");
const {
  validateWeight,
  validateRecordedAt,
  parseRecordedAt,
  createWeightEntry,
  getWeightHistory,
  getLatestWeight,
  getWeightTrend,
  deleteWeightEntry,
  HISTORY_MAX_LIMIT,
} = require("../src/services/weightService");
const { getDb } = require("../src/config/database");

let testDb;
let userIdA;
let userIdB;

beforeAll(() => {
  testDb = setupTestDb();
  const db = getDb();
  const resA = db.prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)").run("Weight User A", "weighta@test.com", "hash");
  userIdA = resA.lastInsertRowid;
  const resB = db.prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)").run("Weight User B", "weightb@test.com", "hash");
  userIdB = resB.lastInsertRowid;
});

afterAll(() => {
  teardownTestDb();
});

beforeEach(() => {
  testDb.exec("DELETE FROM weight_history");
  testDb.exec("DELETE FROM calorie_macro_history");
  const db = getDb();
  db.prepare("UPDATE profiles SET needs_calorie_recalculation = 0 WHERE user_id = ?").run(userIdA);
  db.prepare("UPDATE profiles SET needs_calorie_recalculation = 0 WHERE user_id = ?").run(userIdB);
});

describe("Weight Service", () => {
  describe("validateWeight", () => {
    test("returns true for valid weights", () => {
      expect(validateWeight(30)).toBe(true);
      expect(validateWeight(100)).toBe(true);
      expect(validateWeight(300)).toBe(true);
      expect(validateWeight(75.5)).toBe(true);
      expect(validateWeight(50.25)).toBe(true);
    });

    test("returns false for weights below 30", () => {
      expect(validateWeight(29)).toBe(false);
      expect(validateWeight(0)).toBe(false);
      expect(validateWeight(20)).toBe(false);
      expect(validateWeight(29.9)).toBe(false);
    });

    test("returns false for weights above 300", () => {
      expect(validateWeight(301)).toBe(false);
      expect(validateWeight(500)).toBe(false);
      expect(validateWeight(1000)).toBe(false);
    });

    test("returns false for non-number values", () => {
      expect(validateWeight("75")).toBe(false);
      expect(validateWeight(null)).toBe(false);
      expect(validateWeight(undefined)).toBe(false);
      expect(validateWeight("abc")).toBe(false);
    });

    test("returns false for NaN and Infinity", () => {
      expect(validateWeight(NaN)).toBe(false);
      expect(validateWeight(Infinity)).toBe(false);
      expect(validateWeight(-Infinity)).toBe(false);
    });
  });

  describe("validateRecordedAt", () => {
    test("returns true for valid past/present dates", () => {
      expect(validateRecordedAt("2024-01-15T10:00:00.000Z")).toBe(true);
      expect(validateRecordedAt(new Date().toISOString())).toBe(true);
      expect(validateRecordedAt("2020-06-01T08:30:00.000Z")).toBe(true);
    });

    test("returns false for future dates", () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      expect(validateRecordedAt(future)).toBe(false);
    });

    test("returns false for invalid date strings", () => {
      expect(validateRecordedAt("invalid")).toBe(false);
      expect(validateRecordedAt("not-a-date")).toBe(false);
    });

    test("returns true for null/undefined (optional field)", () => {
      expect(validateRecordedAt(null)).toBe(true);
      expect(validateRecordedAt(undefined)).toBe(true);
      expect(validateRecordedAt("")).toBe(true);
    });
  });

  describe("parseRecordedAt", () => {
    test("returns current ISO date when no recorded_at provided", () => {
      const result = parseRecordedAt(null);
      const parsed = new Date(result);
      expect(parsed.getTime()).not.toBeNaN();
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test("returns normalized ISO string for provided date", () => {
      const result = parseRecordedAt("2024-01-15T10:00:00.000Z");
      expect(result).toBe("2024-01-15T10:00:00.000Z");
    });

    test("returns current ISO date for undefined input", () => {
      const result = parseRecordedAt(undefined);
      const parsed = new Date(result);
      expect(parsed.getTime()).not.toBeNaN();
    });
  });

  describe("createWeightEntry", () => {
    test("creates a weight entry with required fields", async () => {
      const entry = await createWeightEntry(userIdA, { weight: 75 });
      expect(entry.id).toBeDefined();
      expect(entry.user_id).toBe(userIdA);
      expect(entry.weight).toBe(75);
      expect(entry.recorded_at).toBeDefined();
    });

    test("uses provided recorded_at", async () => {
      const recordedAt = "2024-01-15T10:00:00.000Z";
      const entry = await createWeightEntry(userIdA, { weight: 75, recorded_at: recordedAt });
      expect(entry.recorded_at).toBe(recordedAt);
    });

    test("defaults recorded_at to now when not provided", async () => {
      const before = new Date();
      const entry = await createWeightEntry(userIdA, { weight: 75 });
      const after = new Date();
      const entryDate = new Date(entry.recorded_at);
      expect(entryDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(entryDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test("sets needs_calorie_recalculation flag when profile exists", async () => {
      const db = getDb();
      db.prepare("INSERT INTO profiles (user_id, gender, age, height, weight, activity_level, fitness_goal, monthly_diet_budget, gym_experience_level, needs_calorie_recalculation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(userIdA, "male", 25, 180, 76, "moderate", "bulk", 300, "beginner", 0);
      await createWeightEntry(userIdA, { weight: 80 });
      const profile = db.prepare("SELECT needs_calorie_recalculation FROM profiles WHERE user_id = ?").get(userIdA);
      expect(profile.needs_calorie_recalculation).toBe(1);
    });

    test("does not throw when profile does not exist", async () => {
      const db = getDb();
      db.prepare("DELETE FROM profiles WHERE user_id = ?").run(userIdA);
      await expect(createWeightEntry(userIdA, { weight: 75 })).resolves.toBeDefined();
    });

    test("creates multiple entries for same user", async () => {
      await createWeightEntry(userIdA, { weight: 75, recorded_at: "2024-01-10T10:00:00.000Z" });
      await createWeightEntry(userIdA, { weight: 74.5, recorded_at: "2024-01-15T10:00:00.000Z" });
      const result = await getWeightHistory(userIdA, { page: 1, limit: 10 });
      expect(result.data.length).toBe(2);
    });
  });

  describe("getWeightHistory", () => {
    beforeEach(async () => {
      await createWeightEntry(userIdA, { weight: 75, recorded_at: "2024-01-10T10:00:00.000Z" });
      await createWeightEntry(userIdA, { weight: 74, recorded_at: "2024-01-15T10:00:00.000Z" });
      await createWeightEntry(userIdA, { weight: 73, recorded_at: "2024-01-20T10:00:00.000Z" });
    });

    test("returns all entries with pagination", async () => {
      const result = await getWeightHistory(userIdA, { page: 1, limit: 10 });
      expect(result.data.length).toBe(3);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    test("filters by start_date", async () => {
      const result = await getWeightHistory(userIdA, { start_date: "2024-01-12T00:00:00.000Z" });
      expect(result.data.length).toBe(2);
    });

    test("filters by end_date", async () => {
      const result = await getWeightHistory(userIdA, { end_date: "2024-01-12T00:00:00.000Z" });
      expect(result.data.length).toBe(1);
      expect(result.data[0].weight).toBe(75);
    });

    test("returns empty for non-existent user", async () => {
      const result = await getWeightHistory(99999);
      expect(result.data.length).toBe(0);
      expect(result.pagination.total).toBe(0);
    });

    test("paginates correctly", async () => {
      const page1 = await getWeightHistory(userIdA, { page: 1, limit: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.pagination.totalPages).toBe(2);
      const page2 = await getWeightHistory(userIdA, { page: 2, limit: 2 });
      expect(page2.data.length).toBe(1);
    });

    test("orders by recorded_at DESC", async () => {
      const result = await getWeightHistory(userIdA);
      expect(new Date(result.data[0].recorded_at) >= new Date(result.data[1].recorded_at)).toBe(true);
    });

    test("caps limit at maximum", async () => {
      const result = await getWeightHistory(userIdA, { limit: 1000 });
      expect(result.pagination.limit).toBe(HISTORY_MAX_LIMIT);
    });

    test("defaults page to 1 for invalid input", async () => {
      const result = await getWeightHistory(userIdA, { page: "invalid" });
      expect(result.pagination.page).toBe(1);
    });

    test("isolates data by user", async () => {
      await createWeightEntry(userIdB, { weight: 80, recorded_at: "2024-01-11T10:00:00.000Z" });
      const resultA = await getWeightHistory(userIdA);
      const resultB = await getWeightHistory(userIdB);
      expect(resultA.data.length).toBe(3);
      expect(resultB.data.length).toBe(1);
    });
  });

  describe("getLatestWeight", () => {
    test("returns latest weight entry", async () => {
      await createWeightEntry(userIdA, { weight: 75, recorded_at: "2024-01-10T10:00:00.000Z" });
      await createWeightEntry(userIdA, { weight: 74, recorded_at: "2024-01-20T10:00:00.000Z" });
      const entry = await getLatestWeight(userIdA);
      expect(entry).not.toBeNull();
      expect(entry.weight).toBe(74);
      expect(entry.recorded_at).toBe("2024-01-20T10:00:00.000Z");
    });

    test("returns null when no entries exist", async () => {
      const entry = await getLatestWeight(userIdB);
      expect(entry).toBeNull();
    });

    test("returns most recent by recorded_at", async () => {
      await createWeightEntry(userIdA, { weight: 75 });
      await createWeightEntry(userIdA, { weight: 74 });
      const entry = await getLatestWeight(userIdA);
      expect(entry.weight).toBe(74);
    });
  });

  describe("getWeightTrend", () => {
    const daysAgo = (d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();

    beforeEach(async () => {
      await createWeightEntry(userIdA, { weight: 80, recorded_at: daysAgo(20) });
      await createWeightEntry(userIdA, { weight: 79, recorded_at: daysAgo(15) });
      await createWeightEntry(userIdA, { weight: 78, recorded_at: daysAgo(5) });
      await createWeightEntry(userIdA, { weight: 77, recorded_at: daysAgo(1) });
    });

    test("returns trend for 30-day period", async () => {
      const trend = await getWeightTrend(userIdA, 30);
      expect(trend.period_days).toBe(30);
      expect(trend.entries).toBeGreaterThan(0);
      expect(trend.first_weight).toBeDefined();
      expect(trend.last_weight).toBeDefined();
    });

    test("calculates weight change correctly", async () => {
      const trend = await getWeightTrend(userIdA, 365);
      expect(trend.first_weight).toBe(80);
      expect(trend.last_weight).toBe(77);
      expect(trend.weight_change).toBe(-3);
    });

    test("calculates average weight correctly", async () => {
      const trend = await getWeightTrend(userIdA, 365);
      const expectedAvg = Math.round(((80 + 79 + 78 + 77) / 4) * 100) / 100;
      expect(trend.average_weight).toBe(expectedAvg);
    });

    test("calculates min and max weight", async () => {
      const trend = await getWeightTrend(userIdA, 365);
      expect(trend.min_weight).toBe(77);
      expect(trend.max_weight).toBe(80);
    });

    test("returns empty trend when no entries", async () => {
      const trend = await getWeightTrend(userIdB, 30);
      expect(trend.entries).toBe(0);
      expect(trend.first_weight).toBeNull();
      expect(trend.last_weight).toBeNull();
      expect(trend.weight_change).toBeNull();
    });

    test("defaults to 30 days when no parameter", async () => {
      const trend = await getWeightTrend(userIdA);
      expect(trend.period_days).toBe(30);
    });

    test("supports 7-day trend", async () => {
      const trend = await getWeightTrend(userIdA, 7);
      expect(trend.period_days).toBe(7);
    });

    test("supports 90-day trend", async () => {
      const trend = await getWeightTrend(userIdA, 90);
      expect(trend.period_days).toBe(90);
    });
  });

  describe("deleteWeightEntry", () => {
    test("deletes own weight entry", async () => {
      const entry = await createWeightEntry(userIdA, { weight: 75, recorded_at: "2024-01-10T10:00:00.000Z" });
      const deleted = await deleteWeightEntry(userIdA, entry.id);
      expect(deleted).toBe(true);
      const found = await getLatestWeight(userIdA);
      expect(found).toBeNull();
    });

    test("returns false for non-existent id", async () => {
      const deleted = await deleteWeightEntry(userIdA, 99999);
      expect(deleted).toBe(false);
    });

    test("does not delete other user entry", async () => {
      const entry = await createWeightEntry(userIdA, { weight: 75, recorded_at: "2024-01-10T10:00:00.000Z" });
      const deleted = await deleteWeightEntry(userIdB, entry.id);
      expect(deleted).toBe(false);
      const found = await getLatestWeight(userIdA);
      expect(found).not.toBeNull();
      expect(found.weight).toBe(75);
    });

    test("does not clear needs_calorie_recalculation flag", async () => {
      const db = getDb();
      db.prepare("INSERT OR IGNORE INTO profiles (user_id, gender, age, height, weight, activity_level, fitness_goal, monthly_diet_budget, gym_experience_level, needs_calorie_recalculation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(userIdA, "male", 25, 180, 76, "moderate", "bulk", 300, "beginner", 0);
      await createWeightEntry(userIdA, { weight: 80, recorded_at: "2024-01-15T10:00:00.000Z" });
      const profileBefore = db.prepare("SELECT needs_calorie_recalculation FROM profiles WHERE user_id = ?").get(userIdA);
      expect(profileBefore.needs_calorie_recalculation).toBe(1);
      const entry = await createWeightEntry(userIdA, { weight: 79, recorded_at: "2024-01-16T10:00:00.000Z" });
      await deleteWeightEntry(userIdA, entry.id);
      const profileAfter = db.prepare("SELECT needs_calorie_recalculation FROM profiles WHERE user_id = ?").get(userIdA);
      expect(profileAfter.needs_calorie_recalculation).toBe(1);
    });
  });
});
