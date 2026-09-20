const { setupTestDb, teardownTestDb } = require("./setup");
const {
  createProgressLog,
  getProgressLogs,
  getProgressLogById,
  deleteProgressLog,
  validateLogType,
  validateValueJson,
  validateLoggedAt,
  LOG_TYPES,
  completeMeal,
  completeWorkout,
} = require("../src/services/progressService");

let testDb;
let userIdA;

beforeAll(() => {
  testDb = setupTestDb();
  const { connect } = require("../src/config/database");
  const db = connect();
  const userResult = db.prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)").run("Test User", "test@test.com", "hash");
  userIdA = userResult.lastInsertRowid;
});

afterAll(() => {
  teardownTestDb();
});

beforeEach(() => {
  testDb.exec("DELETE FROM progress_logs");
  const db = require("../src/config/database").getDb();
  db.prepare("DELETE FROM users WHERE email = ?").run("userb@test.com");
});

describe("Progress Service", () => {
  describe("validateLogType", () => {
    test("returns true for valid log types", () => {
      LOG_TYPES.forEach((type) => {
        expect(validateLogType(type)).toBe(true);
      });
    });

    test("returns false for invalid log types", () => {
      expect(validateLogType("invalid")).toBe(false);
      expect(validateLogType("")).toBe(false);
      expect(validateLogType(null)).toBe(false);
      expect(validateLogType(undefined)).toBe(false);
    });
  });

  describe("validateValueJson", () => {
    test("returns true for valid non-empty objects", () => {
      expect(validateValueJson({ key: "value" })).toBe(true);
      expect(validateValueJson({ a: 1, b: 2 })).toBe(true);
      expect(validateValueJson({ nested: { value: true } })).toBe(true);
    });

    test("returns false for invalid values", () => {
      expect(validateValueJson(null)).toBe(false);
      expect(validateValueJson(undefined)).toBe(false);
      expect(validateValueJson("")).toBe(false);
      expect(validateValueJson([])).toBe(false);
      expect(validateValueJson({})).toBe(false);
      expect(validateValueJson(123)).toBe(false);
    });
  });

  describe("validateLoggedAt", () => {
    test("returns true for valid past/present dates", () => {
      expect(validateLoggedAt("2024-01-15T10:00:00.000Z")).toBe(true);
      expect(validateLoggedAt(new Date().toISOString())).toBe(true);
      expect(validateLoggedAt("2020-01-01T00:00:00.000Z")).toBe(true);
    });

    test("returns false for future dates", () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      expect(validateLoggedAt(future)).toBe(false);
    });

    test("returns false for invalid dates", () => {
      expect(validateLoggedAt("invalid")).toBe(false);
      expect(validateLoggedAt("")).toBe(false);
      expect(validateLoggedAt("not-a-date")).toBe(false);
      expect(validateLoggedAt("12345")).toBe(false);
    });

    test("returns true for null/undefined (optional)", () => {
      expect(validateLoggedAt(null)).toBe(true);
      expect(validateLoggedAt(undefined)).toBe(true);
    });
  });

  describe("createProgressLog", () => {
    test("creates a progress log with required fields", async () => {
      const log = await createProgressLog(userIdA, {
        log_type: "weight",
        value_json: { weight: 75, unit: "kg" },
      });

      expect(log.id).toBeDefined();
      expect(log.user_id).toBe(userIdA);
      expect(log.log_type).toBe("weight");
      expect(log.value_json).toEqual({ weight: 75, unit: "kg" });
      expect(log.logged_at).toBeDefined();
    });

    test("uses provided logged_at", async () => {
      const loggedAt = "2024-01-15T10:00:00.000Z";
      const log = await createProgressLog(userIdA, {
        log_type: "workout_completion",
        value_json: { workout_id: 1 },
        logged_at: loggedAt,
      });

      expect(log.logged_at).toBe(loggedAt);
    });

    test("stores value_json as JSON in database", async () => {
      await createProgressLog(userIdA, {
        log_type: "measurement",
        value_json: { chest: 100, waist: 80 },
      });

      const db = require("../src/config/database").getDb();
      const record = db.prepare("SELECT value_json FROM progress_logs WHERE user_id = ?").get(userIdA);
      expect(JSON.parse(record.value_json)).toEqual({ chest: 100, waist: 80 });
    });

    test("creates multiple logs for same user", async () => {
      await createProgressLog(userIdA, { log_type: "weight", value_json: { weight: 75 } });
      await createProgressLog(userIdA, { log_type: "weight", value_json: { weight: 74.5 } });

      const result = await getProgressLogs(userIdA);
      expect(result.data.length).toBe(2);
    });
  });

  describe("getProgressLogs", () => {
    beforeEach(async () => {
      await createProgressLog(userIdA, { log_type: "weight", value_json: { weight: 75 }, logged_at: "2024-01-10T10:00:00.000Z" });
      await createProgressLog(userIdA, { log_type: "weight", value_json: { weight: 74 }, logged_at: "2024-01-15T10:00:00.000Z" });
      await createProgressLog(userIdA, { log_type: "workout_completion", value_json: { workout: "push" }, logged_at: "2024-01-20T10:00:00.000Z" });
    });

    test("returns all logs for user with pagination", async () => {
      const result = await getProgressLogs(userIdA, { page: 1, limit: 10 });
      expect(result.data.length).toBe(3);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    test("filters by log_type", async () => {
      const result = await getProgressLogs(userIdA, { log_type: "weight" });
      expect(result.data.length).toBe(2);
      result.data.forEach((log) => expect(log.log_type).toBe("weight"));
    });

    test("filters by start_date", async () => {
      const result = await getProgressLogs(userIdA, { start_date: "2024-01-16T00:00:00.000Z" });
      expect(result.data.length).toBe(1);
      expect(result.data[0].log_type).toBe("workout_completion");
    });

    test("filters by end_date", async () => {
      const result = await getProgressLogs(userIdA, { end_date: "2024-01-12T00:00:00.000Z" });
      expect(result.data.length).toBe(1);
      expect(result.data[0].log_type).toBe("weight");
    });

    test("returns empty for non-existent user", async () => {
      const result = await getProgressLogs(99999);
      expect(result.data.length).toBe(0);
      expect(result.pagination.total).toBe(0);
    });

    test("paginates correctly", async () => {
      const page1 = await getProgressLogs(userIdA, { page: 1, limit: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.pagination.totalPages).toBe(2);

      const page2 = await getProgressLogs(userIdA, { page: 2, limit: 2 });
      expect(page2.data.length).toBe(1);
    });

    test("orders by logged_at DESC", async () => {
      const result = await getProgressLogs(userIdA);
      expect(new Date(result.data[0].logged_at) >= new Date(result.data[1].logged_at)).toBe(true);
    });

    test("caps limit at maximum", async () => {
      const result = await getProgressLogs(userIdA, { limit: 1000 });
      expect(result.pagination.limit).toBe(100);
    });

    test("defaults page to 1", async () => {
      const result = await getProgressLogs(userIdA, { page: "invalid" });
      expect(result.pagination.page).toBe(1);
    });
  });

  describe("getProgressLogById", () => {
    test("returns log by id for owner", async () => {
      const created = await createProgressLog(userIdA, { log_type: "weight", value_json: { weight: 75 } });
      const log = await getProgressLogById(userIdA, created.id);
      expect(log).not.toBeNull();
      expect(log.id).toBe(created.id);
      expect(log.value_json).toEqual({ weight: 75 });
    });

    test("returns null for non-existent id", async () => {
      const log = await getProgressLogById(userIdA, 99999);
      expect(log).toBeNull();
    });

    test("returns null for other user's log", async () => {
      const db = require("../src/config/database").getDb();
      const userResult = db.prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)").run("User B", "userb@test.com", "hash");
      const userIdB = userResult.lastInsertRowid;

      const created = await createProgressLog(userIdA, { log_type: "weight", value_json: { weight: 75 } });
      const log = await getProgressLogById(userIdB, created.id);
      expect(log).toBeNull();
    });
  });

  describe("deleteProgressLog", () => {
    test("deletes own log", async () => {
      const created = await createProgressLog(userIdA, { log_type: "weight", value_json: { weight: 75 } });
      const deleted = await deleteProgressLog(userIdA, created.id);
      expect(deleted).toBe(true);

      const log = await getProgressLogById(userIdA, created.id);
      expect(log).toBeNull();
    });

    test("returns false for non-existent id", async () => {
      const deleted = await deleteProgressLog(userIdA, 99999);
      expect(deleted).toBe(false);
    });

    test("does not delete other user's log", async () => {
      const db = require("../src/config/database").getDb();
      const userResult = db.prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)").run("User B", "userb@test.com", "hash");
      const userIdB = userResult.lastInsertRowid;

      const created = await createProgressLog(userIdA, { log_type: "weight", value_json: { weight: 75 } });
      const deleted = await deleteProgressLog(userIdB, created.id);
      expect(deleted).toBe(false);

      const log = await getProgressLogById(userIdA, created.id);
      expect(log).not.toBeNull();
    });
  });

  describe("completeMeal", () => {
    test("allows first completion of meal on current date", async () => {
      const result = await completeMeal(userIdA, "Breakfast");
      expect(result.alreadyCompleted).toBe(false);
      expect(result.value_json.meal_name).toBe("Breakfast");
      expect(result.value_json.completed).toBe(true);
    });

    test("prevents duplicate completion of same meal on same date", async () => {
      const first = await completeMeal(userIdA, "Lunch");
      expect(first.alreadyCompleted).toBe(false);

      const second = await completeMeal(userIdA, "Lunch");
      expect(second.alreadyCompleted).toBe(true);
    });

    test("allows same meal on a different date", async () => {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
      }).format(new Date());
      const db = require("../src/config/database").getDb();
      
      // manually insert log for a different date
      db.prepare(`
        INSERT INTO progress_logs (user_id, log_type, value_json, logged_at) 
        VALUES (?, ?, ?, ?)
      `).run(
        userIdA,
        "meal_compliance",
        JSON.stringify({ meal_name: "Dinner", completed: true, completed_date: "2020-01-01" }),
        "2020-01-01T10:00:00.000Z"
      );

      const result = await completeMeal(userIdA, "Dinner");
      expect(result.alreadyCompleted).toBe(false);
      expect(result.value_json.completed_date).toBe(today);
    });
  });

  describe("completeWorkout", () => {
    test("allows first completion of workout on current date", async () => {
      const result = await completeWorkout(userIdA, "Push Day");
      expect(result.alreadyCompleted).toBe(false);
      expect(result.value_json.workout_name).toBe("Push Day");
      expect(result.value_json.completed).toBe(true);
    });

    test("prevents duplicate completion of same workout on same date", async () => {
      const first = await completeWorkout(userIdA, "Pull Day");
      expect(first.alreadyCompleted).toBe(false);

      const second = await completeWorkout(userIdA, "Pull Day");
      expect(second.alreadyCompleted).toBe(true);
    });

    test("allows same workout on a different date", async () => {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
      }).format(new Date());
      const db = require("../src/config/database").getDb();
      
      // manually insert log for a different date
      db.prepare(`
        INSERT INTO progress_logs (user_id, log_type, value_json, logged_at) 
        VALUES (?, ?, ?, ?)
      `).run(
        userIdA,
        "workout_completion",
        JSON.stringify({ workout_name: "Leg Day", completed: true, completed_date: "2020-01-01" }),
        "2020-01-01T10:00:00.000Z"
      );

      const result = await completeWorkout(userIdA, "Leg Day");
      expect(result.alreadyCompleted).toBe(false);
      expect(result.value_json.completed_date).toBe(today);
    });
  });
});