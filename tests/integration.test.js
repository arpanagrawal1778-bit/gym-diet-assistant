const request = require("supertest");
const { setupTestDb, teardownTestDb } = require("./setup");
const { app } = require("../src/server");
const { getDb } = require("../src/config/database");

let testServer;
let userAToken;
let userBToken;
let userIdA;
let userIdB;

beforeAll((done) => {
  setupTestDb();
  testServer = app.listen(0, done);
});

afterAll((done) => {
  testServer.close();
  teardownTestDb();
  done();
});

async function createUser(name, email, password) {
  const res = await request(testServer)
    .post("/api/auth/signup")
    .send({ name, email, password });
  return res;
}

async function createProfile(token, overrides = {}) {
  const profile = {
    gender: "male",
    age: 25,
    height: 180,
    weight: 76,
    activity_level: "moderate",
    fitness_goal: "bulk",
    monthly_diet_budget: 300,
    gym_experience_level: "beginner",
    diet_preference: "vegetarian",
    ...overrides,
  };
  return request(testServer).post("/api/profile").set("Authorization", `Bearer ${token}`).send(profile);
}

const baseProfile = {
  gender: "male",
  age: 25,
  height: 180,
  weight: 76,
  activity_level: "moderate",
  fitness_goal: "bulk",
  monthly_diet_budget: 300,
  gym_experience_level: "beginner",
  diet_preference: "vegetarian",
};

describe("Phase 2 Integration Tests", () => {
  describe("Setup", () => {
    test("create user A", async () => {
      const res = await createUser("User A", "usera@test.com", "password123");
      expect(res.status).toBe(201);
      userIdA = res.body.data.user.id;
      userAToken = res.body.data.token;
    });

    test("create user B", async () => {
      const res = await createUser("User B", "userb@test.com", "password123");
      expect(res.status).toBe(201);
      userIdB = res.body.data.user.id;
      userBToken = res.body.data.token;
    });
  });

  describe("GET /api/health", () => {
    test("returns health status", async () => {
      const res = await request(testServer).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("POST /api/profile (auto-calculation)", () => {
    beforeEach(() => {
      const db = getDb();
      db.exec("DELETE FROM calorie_macro_history");
      db.exec("DELETE FROM profiles");
    });

    test("create profile with auto-calculation for user A", async () => {
      const res = await createProfile(userAToken);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.calculation).toBeDefined();
      const calc = res.body.data.calculation;
      expect(calc.bmr).toBe(1765);
      expect(calc.tdee).toBe(2736);
      expect(calc.calorie_target).toBe(3010);
    });

    test("create profile for female with auto-calculation", async () => {
      const res = await createProfile(userBToken, { gender: "female", age: 22, height: 165, weight: 60, activity_level: "light", fitness_goal: "cut", monthly_diet_budget: 250 });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.calculation).toBeDefined();
    });

    test("create profile without auth returns 401", async () => {
      const res = await request(testServer).post("/api/profile").send(baseProfile);
      expect(res.status).toBe(401);
    });

    test("create profile with invalid data returns 400", async () => {
      const res = await createProfile(userAToken, { age: 12 });
      expect(res.status).toBe(400);
    });

    test("create duplicate profile returns 409", async () => {
      await createProfile(userAToken);
      const res = await createProfile(userAToken);
      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/calculations/current", () => {
    beforeEach(() => {
      const db = getDb();
      db.exec("DELETE FROM calorie_macro_history");
      db.exec("DELETE FROM profiles");
    });

    test("get current target after profile creation", async () => {
      await createProfile(userAToken);
      const res = await request(testServer).get("/api/calculations/current").set("Authorization", `Bearer ${userAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bmr).toBeDefined();
      expect(res.body.data.tdee).toBeDefined();
      expect(res.body.data.calorie_target).toBeDefined();
      expect(res.body.data.protein_grams).toBeDefined();
      expect(res.body.data.carbs_grams).toBeDefined();
      expect(res.body.data.fat_grams).toBeDefined();
      expect(res.body.data.fitness_goal).toBe("bulk");
      expect(res.body.data.activity_level).toBe("moderate");
    });

    test("no calculation returns 404", async () => {
      const res = await request(testServer).get("/api/calculations/current").set("Authorization", `Bearer ${userAToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("PROFILE_NOT_FOUND");
    });

    test("unauthenticated returns 401", async () => {
      const res = await request(testServer).get("/api/calculations/current");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/calculations/history", () => {
    beforeEach(() => {
      const db = getDb();
      db.exec("DELETE FROM calorie_macro_history");
      db.exec("DELETE FROM profiles");
    });

    test("get history after profile creation", async () => {
      await createProfile(userAToken);
      const res = await request(testServer).get("/api/calculations/history").set("Authorization", `Bearer ${userAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const latest = res.body.data[0];
      expect(latest.fitness_goal).toBe("bulk");
      expect(latest.activity_level).toBe("moderate");
    });

    test("history ordered newest first", async () => {
      await createProfile(userAToken);
      const res = await request(testServer).get("/api/calculations/history").set("Authorization", `Bearer ${userAToken}`);
      if (res.body.data.length > 1) {
        const firstDate = new Date(res.body.data[0].effective_at);
        const secondDate = new Date(res.body.data[1].effective_at);
        expect(firstDate >= secondDate).toBe(true);
      }
    });

    test("unauthenticated returns 401", async () => {
      const res = await request(testServer).get("/api/calculations/history");
      expect(res.status).toBe(401);
    });

    test("pagination works", async () => {
      await createProfile(userAToken);
      const res = await request(testServer).get("/api/calculations/history?page=1&limit=10").set("Authorization", `Bearer ${userAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
    });

    test("history is read-only (no POST route)", async () => {
      const res = await request(testServer).post("/api/calculations/history").set("Authorization", `Bearer ${userAToken}`).send({});
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/profile (recalculation)", () => {
    beforeEach(() => {
      const db = getDb();
      db.exec("DELETE FROM calorie_macro_history");
      db.exec("DELETE FROM profiles");
    });

    test("change weight triggers recalculation", async () => {
      await createProfile(userAToken);
      const beforeRes = await request(testServer).get("/api/calculations/current").set("Authorization", `Bearer ${userAToken}`);
      const beforeTdee = beforeRes.body.data.tdee;

      const res = await request(testServer).put("/api/profile").set("Authorization", `Bearer ${userAToken}`).send({ ...baseProfile, weight: 80 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.calculation).toBeDefined();
      expect(res.body.data.weight).toBe(80);
      expect(res.body.data.calculation.tdee).not.toBe(beforeTdee);
    });

    test("change age triggers recalculation", async () => {
      await createProfile(userAToken);
      const res = await request(testServer).put("/api/profile").set("Authorization", `Bearer ${userAToken}`).send({ ...baseProfile, age: 26 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.calculation).toBeDefined();
    });

    test("change activity_level triggers recalculation", async () => {
      await createProfile(userAToken);
      const res = await request(testServer).put("/api/profile").set("Authorization", `Bearer ${userAToken}`).send({ ...baseProfile, activity_level: "active" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.calculation).toBeDefined();
    });

    test("change fitness_goal triggers recalculation", async () => {
      await createProfile(userAToken);
      const res = await request(testServer).put("/api/profile").set("Authorization", `Bearer ${userAToken}`).send({ ...baseProfile, fitness_goal: "cut" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.calculation).toBeDefined();
    });

    test("change gender triggers recalculation", async () => {
      await createProfile(userAToken);
      const res = await request(testServer).put("/api/profile").set("Authorization", `Bearer ${userAToken}`).send({ ...baseProfile, gender: "female" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("change height triggers recalculation", async () => {
      await createProfile(userAToken);
      const res = await request(testServer).put("/api/profile").set("Authorization", `Bearer ${userAToken}`).send({ ...baseProfile, height: 185 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("change allergies only does NOT recalculate", async () => {
      await createProfile(userAToken);
      const res = await request(testServer).put("/api/profile").set("Authorization", `Bearer ${userAToken}`).send({ ...baseProfile, allergies: ["peanuts"] });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.calculation).toBeUndefined();
    });

    test("change injuries only does NOT recalculate", async () => {
      await createProfile(userAToken);
      const res = await request(testServer).put("/api/profile").set("Authorization", `Bearer ${userAToken}`).send({ ...baseProfile, injuries: [{ category: "knee", detail: "test" }] });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.calculation).toBeUndefined();
    });

    test("change budget only does NOT recalculate", async () => {
      await createProfile(userAToken);
      const res = await request(testServer).put("/api/profile").set("Authorization", `Bearer ${userAToken}`).send({ ...baseProfile, monthly_diet_budget: 500 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.calculation).toBeUndefined();
    });

    test("change target_body_description only does NOT recalculate", async () => {
      await createProfile(userAToken);
      const res = await request(testServer).put("/api/profile").set("Authorization", `Bearer ${userAToken}`).send({ ...baseProfile, target_body_description: "New desc" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.calculation).toBeUndefined();
    });
  });

  describe("GET /api/plans/placeholder", () => {
    beforeEach(() => {
      const db = getDb();
      db.exec("DELETE FROM calorie_macro_history");
      db.exec("DELETE FROM profiles");
    });

    test("get placeholder plan", async () => {
      await createProfile(userAToken);
      const res = await request(testServer).get("/api/plans/placeholder").set("Authorization", `Bearer ${userAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe("placeholder");
      expect(res.body.data.meals).toBeDefined();
      expect(Array.isArray(res.body.data.meals)).toBe(true);
    });

    test("placeholder plan is not AI-generated", async () => {
      await createProfile(userAToken);
      const res = await request(testServer).get("/api/plans/placeholder").set("Authorization", `Bearer ${userAToken}`);
      expect(res.body.data.type).toBe("placeholder");
      expect(res.body.data.disclaimer).toBeDefined();
    });

    test("unauthenticated returns 401", async () => {
      const res = await request(testServer).get("/api/plans/placeholder");
      expect(res.status).toBe(401);
    });
  });

  describe("Edge cases", () => {
    test("age = 12 rejected", async () => {
      const res = await createProfile(userAToken, { age: 12 });
      expect(res.status).toBe(400);
    });

    test("height = 99 rejected", async () => {
      const res = await createProfile(userAToken, { height: 99 });
      expect(res.status).toBe(400);
    });

    test("weight = 29 rejected", async () => {
      const res = await createProfile(userAToken, { weight: 29 });
      expect(res.status).toBe(400);
    });

    test("invalid activity level rejected", async () => {
      const res = await createProfile(userAToken, { activity_level: "invalid" });
      expect(res.status).toBe(400);
    });

    test("invalid fitness goal rejected", async () => {
      const res = await createProfile(userAToken, { fitness_goal: "invalid" });
      expect(res.status).toBe(400);
    });

    test("malformed JSON rejected", async () => {
      const res = await request(testServer)
        .post("/api/profile")
        .set("Authorization", `Bearer ${userAToken}`)
        .set("Content-Type", "application/json")
        .send("not valid json");
      expect(res.status).toBe(400);
    });

    test("unauthenticated profile creation returns 401", async () => {
      const res = await request(testServer).post("/api/profile").send(baseProfile);
      expect(res.status).toBe(401);
    });
  });

  describe("Phase 3 Integration Tests", () => {
    beforeEach(() => {
      const db = getDb();
      db.exec("DELETE FROM schedules");
      db.exec("DELETE FROM gym_plans");
      db.exec("DELETE FROM diet_plans");
      db.exec("DELETE FROM calorie_macro_history");
      db.exec("DELETE FROM profiles");
    });

    async function setupUsersWithProfiles() {
      await createProfile(userAToken, { ...baseProfile, allergies: ["dairy"], injuries: [{ category: "knee", detail: "old injury" }], college_start_time: "09:00", college_end_time: "17:00", college_days: ["Mon", "Tue", "Wed", "Thu", "Fri"] });
      await createProfile(userBToken, { ...baseProfile, gender: "female", age: 22, height: 165, weight: 60, activity_level: "light", fitness_goal: "cut" });
    }

    describe("POST /api/plans/diet", () => {
      test("generate diet plan for authenticated user", async () => {
        await setupUsersWithProfiles();
        const res = await request(testServer)
          .post("/api/plans/diet")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.type).toBeDefined();
        expect(res.body.data.weekly_plan).toBeDefined();
        expect(Array.isArray(res.body.data.weekly_plan)).toBe(true);
        expect(res.body.data.weekly_plan.length).toBe(7);
      });

      test("diet plan contains 4 meals per day", async () => {
        await setupUsersWithProfiles();
        const res = await request(testServer)
          .post("/api/plans/diet")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(201);
        for (const day of res.body.data.weekly_plan) {
          expect(day.meals).toBeDefined();
          expect(day.meals.length).toBe(4);
        }
      });

      test("diet plan respects allergens", async () => {
        await setupUsersWithProfiles();
        const res = await request(testServer)
          .post("/api/plans/diet")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(201);
        const allMealNames = res.body.data.weekly_plan.flatMap((d) => d.meals.map((m) => m.name));
        const dairyMeals = ["Greek Yogurt Bowl", "Protein Oatmeal", "Protein Pancakes"];
        for (const dairyMeal of dairyMeals) {
          expect(allMealNames).not.toContain(dairyMeal);
        }
      });

      test("diet plan includes calorie and macro targets", async () => {
        await setupUsersWithProfiles();
        const res = await request(testServer)
          .post("/api/plans/diet")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(201);
        expect(res.body.data.calorie_target).toBeDefined();
        expect(res.body.data.protein_grams).toBeDefined();
        expect(res.body.data.carbs_grams).toBeDefined();
        expect(res.body.data.fat_grams).toBeDefined();
      });

      test("unauthenticated returns 401", async () => {
        await setupUsersWithProfiles();
        const res = await request(testServer).post("/api/plans/diet");
        expect(res.status).toBe(401);
      });

      test("no profile returns 404", async () => {
        const db = getDb();
        db.exec("DELETE FROM profiles");
        const res = await request(testServer)
          .post("/api/plans/diet")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("PROFILE_NOT_FOUND");
      });
    });

    describe("GET /api/plans/diet", () => {
      test("get current diet plan after generation", async () => {
        await setupUsersWithProfiles();
        await request(testServer).post("/api/plans/diet").set("Authorization", `Bearer ${userAToken}`);
        const res = await request(testServer)
          .get("/api/plans/diet")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.weekly_plan).toBeDefined();
      });

      test("auto-generates when no plan exists and profile has calc", async () => {
        await setupUsersWithProfiles();
        const res = await request(testServer)
          .get("/api/plans/diet")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.weekly_plan).toBeDefined();
      });

      test("returns 404 when profile has no calculation", async () => {
        await setupUsersWithProfiles();
        const db = getDb();
        db.exec("DELETE FROM calorie_macro_history");
        const res = await request(testServer)
          .get("/api/plans/diet")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("CALCULATION_NOT_AVAILABLE");
      });

      test("unauthenticated returns 401", async () => {
        const res = await request(testServer).get("/api/plans/diet");
        expect(res.status).toBe(401);
      });

      test("user cannot access another user's plan", async () => {
        await setupUsersWithProfiles();
        await request(testServer).post("/api/plans/diet").set("Authorization", `Bearer ${userAToken}`);
        const res = await request(testServer)
          .get("/api/plans/diet")
          .set("Authorization", `Bearer ${userBToken}`);
        expect(res.body.data.weekly_plan.length).toBe(7);
        const userAPlan = await request(testServer)
          .get("/api/plans/diet")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(userAPlan.body.data).not.toEqual(res.body.data);
      });
    });

    describe("GET /api/plans/diet/history", () => {
      test("returns paginated diet plan history", async () => {
        await setupUsersWithProfiles();
        await request(testServer).post("/api/plans/diet").set("Authorization", `Bearer ${userAToken}`);
        await request(testServer).post("/api/plans/diet/regenerate").set("Authorization", `Bearer ${userAToken}`);

        const res = await request(testServer)
          .get("/api/plans/diet/history")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(2);
        expect(res.body.pagination).toBeDefined();
      });

      test("pagination works", async () => {
        await setupUsersWithProfiles();
        await request(testServer).post("/api/plans/diet").set("Authorization", `Bearer ${userAToken}`);
        const res = await request(testServer)
          .get("/api/plans/diet/history?page=1&limit=10")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.pagination.page).toBe(1);
        expect(res.body.pagination.limit).toBe(10);
      });

      test("limit capped at 100", async () => {
        await setupUsersWithProfiles();
        await request(testServer).post("/api/plans/diet").set("Authorization", `Bearer ${userAToken}`);
        const res = await request(testServer)
          .get("/api/plans/diet/history?limit=200")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.pagination.limit).toBe(100);
      });

      test("invalid page defaults to 1", async () => {
        await setupUsersWithProfiles();
        await request(testServer).post("/api/plans/diet").set("Authorization", `Bearer ${userAToken}`);
        const res = await request(testServer)
          .get("/api/plans/diet/history?page=invalid")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.pagination.page).toBe(1);
      });

      test("unauthenticated returns 401", async () => {
        const res = await request(testServer).get("/api/plans/diet/history");
        expect(res.status).toBe(401);
      });
    });

    describe("POST /api/plans/diet/regenerate", () => {
      test("force regenerates diet plan", async () => {
        await setupUsersWithProfiles();
        await request(testServer).post("/api/plans/diet").set("Authorization", `Bearer ${userAToken}`);
        const beforeRes = await request(testServer)
          .get("/api/plans/diet")
          .set("Authorization", `Bearer ${userAToken}`);

        const res = await request(testServer)
          .post("/api/plans/diet/regenerate")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.weekly_plan).toBeDefined();
      });

      test("unauthenticated returns 401", async () => {
        const res = await request(testServer).post("/api/plans/diet/regenerate");
        expect(res.status).toBe(401);
      });
    });

    describe("POST /api/plans/gym", () => {
      test("generate gym plan for authenticated user", async () => {
        await setupUsersWithProfiles();
        const res = await request(testServer)
          .post("/api/plans/gym")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.type).toBeDefined();
        expect(res.body.data.weekly_plan).toBeDefined();
        expect(Array.isArray(res.body.data.weekly_plan)).toBe(true);
        expect(res.body.data.weekly_plan.length).toBe(7);
      });

      test("gym plan includes rest day", async () => {
        await setupUsersWithProfiles();
        const res = await request(testServer)
          .post("/api/plans/gym")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(201);
        const restDay = res.body.data.weekly_plan.find((d) => d.focus === "rest");
        expect(restDay).toBeDefined();
      });

      test("gym plan filters exercises for knee injury", async () => {
        await setupUsersWithProfiles();
        const res = await request(testServer)
          .post("/api/plans/gym")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(201);
        const allExercises = res.body.data.weekly_plan.flatMap((d) => d.exercises.map((e) => e.name));
      });

      test("gym plan includes fitness goal", async () => {
        await setupUsersWithProfiles();
        const res = await request(testServer)
          .post("/api/plans/gym")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(201);
        expect(res.body.data.fitness_goal).toBe("bulk");
      });

      test("unauthenticated returns 401", async () => {
        const res = await request(testServer).post("/api/plans/gym");
        expect(res.status).toBe(401);
      });

      test("no profile returns 404", async () => {
        const db = getDb();
        db.exec("DELETE FROM profiles");
        const res = await request(testServer)
          .post("/api/plans/gym")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("PROFILE_NOT_FOUND");
      });
    });

    describe("GET /api/plans/gym", () => {
      test("get current gym plan after generation", async () => {
        await setupUsersWithProfiles();
        await request(testServer).post("/api/plans/gym").set("Authorization", `Bearer ${userAToken}`);
        const res = await request(testServer)
          .get("/api/plans/gym")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.weekly_plan).toBeDefined();
      });

      test("auto-generates when no plan exists", async () => {
        await setupUsersWithProfiles();
        const res = await request(testServer)
          .get("/api/plans/gym")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.weekly_plan).toBeDefined();
        expect(res.body.data.weekly_plan.length).toBe(7);
      });

      test("unauthenticated returns 401", async () => {
        const res = await request(testServer).get("/api/plans/gym");
        expect(res.status).toBe(401);
      });

      test("user data isolation", async () => {
        await setupUsersWithProfiles();
        await request(testServer).post("/api/plans/gym").set("Authorization", `Bearer ${userAToken}`);
        const resB = await request(testServer)
          .get("/api/plans/gym")
          .set("Authorization", `Bearer ${userBToken}`);
        expect(resB.status).toBe(200);
        expect(resB.body.data.weekly_plan.length).toBe(7);
      });
    });

    describe("GET /api/plans/gym/history", () => {
      test("returns paginated gym plan history", async () => {
        await setupUsersWithProfiles();
        await request(testServer).post("/api/plans/gym").set("Authorization", `Bearer ${userAToken}`);
        await request(testServer).post("/api/plans/gym/regenerate").set("Authorization", `Bearer ${userAToken}`);

        const res = await request(testServer)
          .get("/api/plans/gym/history")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(2);
        expect(res.body.pagination).toBeDefined();
      });

      test("unauthenticated returns 401", async () => {
        const res = await request(testServer).get("/api/plans/gym/history");
        expect(res.status).toBe(401);
      });
    });

    describe("POST /api/plans/gym/regenerate", () => {
      test("force regenerates gym plan", async () => {
        await setupUsersWithProfiles();
        await request(testServer).post("/api/plans/gym").set("Authorization", `Bearer ${userAToken}`);
        const res = await request(testServer)
          .post("/api/plans/gym/regenerate")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.weekly_plan).toBeDefined();
      });

      test("unauthenticated returns 401", async () => {
        const res = await request(testServer).post("/api/plans/gym/regenerate");
        expect(res.status).toBe(401);
      });
    });

    describe("GET /api/schedule", () => {
      test("get schedule after diet and gym plans exist", async () => {
        await setupUsersWithProfiles();
        await request(testServer).post("/api/plans/diet").set("Authorization", `Bearer ${userAToken}`);
        await request(testServer).post("/api/plans/gym").set("Authorization", `Bearer ${userAToken}`);
        const res = await request(testServer)
          .get("/api/schedule")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.weekly_schedule).toBeDefined();
        expect(Object.keys(res.body.data.weekly_schedule).length).toBe(7);
      });

      test("schedule includes college day info", async () => {
        await setupUsersWithProfiles();
        await request(testServer).post("/api/plans/diet").set("Authorization", `Bearer ${userAToken}`);
        await request(testServer).post("/api/plans/gym").set("Authorization", `Bearer ${userAToken}`);
        const res = await request(testServer)
          .get("/api/schedule")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.body.data.weekly_schedule["Mon"].is_college_day).toBe(true);
        expect(res.body.data.weekly_schedule["Sat"].is_college_day).toBe(false);
      });

      test("schedule includes meals and workouts", async () => {
        await setupUsersWithProfiles();
        await request(testServer).post("/api/plans/diet").set("Authorization", `Bearer ${userAToken}`);
        await request(testServer).post("/api/plans/gym").set("Authorization", `Bearer ${userAToken}`);
        const res = await request(testServer)
          .get("/api/schedule")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.body.data.weekly_schedule["Mon"].meals).toBeDefined();
        expect(res.body.data.weekly_schedule["Mon"].workouts).toBeDefined();
      });

      test("auto-generates when no schedule exists", async () => {
        await setupUsersWithProfiles();
        const res = await request(testServer)
          .get("/api/schedule")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.weekly_schedule).toBeDefined();
      });

      test("unauthenticated returns 401", async () => {
        const res = await request(testServer).get("/api/schedule");
        expect(res.status).toBe(401);
      });

      test("no profile returns 404", async () => {
        const db = getDb();
        db.exec("DELETE FROM profiles");
        const res = await request(testServer)
          .get("/api/schedule")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("PROFILE_NOT_FOUND");
      });
    });

    describe("POST /api/schedule/regenerate", () => {
      test("force regenerates schedule", async () => {
        await setupUsersWithProfiles();
        await request(testServer).post("/api/plans/diet").set("Authorization", `Bearer ${userAToken}`);
        await request(testServer).post("/api/plans/gym").set("Authorization", `Bearer ${userAToken}`);
        const res = await request(testServer)
          .post("/api/schedule/regenerate")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.weekly_schedule).toBeDefined();
      });

      test("unauthenticated returns 401", async () => {
        const res = await request(testServer).post("/api/schedule/regenerate");
        expect(res.status).toBe(401);
      });
    });

    describe("GET /api/schedule/history", () => {
      test("returns paginated schedule history", async () => {
        await setupUsersWithProfiles();
        await request(testServer).get("/api/schedule").set("Authorization", `Bearer ${userAToken}`);
        await request(testServer).post("/api/schedule/regenerate").set("Authorization", `Bearer ${userAToken}`);

        const res = await request(testServer)
          .get("/api/schedule/history")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(2);
        expect(res.body.pagination).toBeDefined();
      });

      test("unauthenticated returns 401", async () => {
        const res = await request(testServer).get("/api/schedule/history");
        expect(res.status).toBe(401);
      });
    });

    describe("Plan persistence in database", () => {
      test("diet plan is persisted to database", async () => {
        await setupUsersWithProfiles();
        const generateRes = await request(testServer)
          .post("/api/plans/diet")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(generateRes.status).toBe(201);

        const db = getDb();
        const count = db.prepare("SELECT COUNT(*) as count FROM diet_plans WHERE user_id = ?").get(userIdA).count;
        expect(count).toBeGreaterThanOrEqual(1);
      });

      test("gym plan is persisted to database", async () => {
        await setupUsersWithProfiles();
        const generateRes = await request(testServer)
          .post("/api/plans/gym")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(generateRes.status).toBe(201);

        const db = getDb();
        const count = db.prepare("SELECT COUNT(*) as count FROM gym_plans WHERE user_id = ?").get(userIdA).count;
        expect(count).toBeGreaterThanOrEqual(1);
      });

      test("schedule is persisted to database", async () => {
        await setupUsersWithProfiles();
        await request(testServer).get("/api/schedule").set("Authorization", `Bearer ${userAToken}`);

        const db = getDb();
        const count = db.prepare("SELECT COUNT(*) as count FROM schedules WHERE user_id = ?").get(userIdA).count;
        expect(count).toBeGreaterThanOrEqual(1);
      });

      test("user B plan does not appear in user A history", async () => {
        await setupUsersWithProfiles();
        await request(testServer).post("/api/plans/diet").set("Authorization", `Bearer ${userAToken}`);
        await request(testServer).post("/api/plans/diet").set("Authorization", `Bearer ${userBToken}`);

        const resA = await request(testServer)
          .get("/api/plans/diet/history")
          .set("Authorization", `Bearer ${userAToken}`);
        const resB = await request(testServer)
          .get("/api/plans/diet/history")
          .set("Authorization", `Bearer ${userBToken}`);
        expect(resA.body.data.length).toBe(1);
        expect(resB.body.data.length).toBe(1);
        expect(resA.body.data[0].id).not.toBe(resB.body.data[0].id);
      });
    });
  });

  describe("Phase 4A Integration Tests - Progress API", () => {
    beforeEach(() => {
      const db = getDb();
      db.exec("DELETE FROM progress_logs");
    });

    describe("POST /api/progress", () => {
      test("creates a progress log", async () => {
        const res = await request(testServer)
          .post("/api/progress")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ log_type: "weight", value_json: { weight: 75, unit: "kg" } });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.log_type).toBe("weight");
        expect(res.body.data.value_json).toEqual({ weight: 75, unit: "kg" });
      });

      test("without auth returns 401", async () => {
        const res = await request(testServer)
          .post("/api/progress")
          .send({ log_type: "weight", value_json: { weight: 75 } });
        expect(res.status).toBe(401);
      });

      test("invalid log_type returns 400", async () => {
        const res = await request(testServer)
          .post("/api/progress")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ log_type: "invalid_type", value_json: { weight: 75 } });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      });

      test("empty value_json returns 400", async () => {
        const res = await request(testServer)
          .post("/api/progress")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ log_type: "weight", value_json: {} });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      });

      test("future logged_at returns 400", async () => {
        const future = new Date(Date.now() + 86400000).toISOString();
        const res = await request(testServer)
          .post("/api/progress")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ log_type: "weight", value_json: { weight: 75 }, logged_at: future });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      });

      test("missing value_json returns 400", async () => {
        const res = await request(testServer)
          .post("/api/progress")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ log_type: "weight" });
        expect(res.status).toBe(400);
      });
    });

    describe("GET /api/progress", () => {
      test("returns progress logs for user", async () => {
        await request(testServer)
          .post("/api/progress")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ log_type: "weight", value_json: { weight: 75 } });
        const res = await request(testServer)
          .get("/api/progress")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        expect(res.body.pagination).toBeDefined();
      });

      test("without auth returns 401", async () => {
        const res = await request(testServer).get("/api/progress");
        expect(res.status).toBe(401);
      });

      test("filters by log_type", async () => {
        await request(testServer)
          .post("/api/progress")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ log_type: "weight", value_json: { weight: 75 } });
        await request(testServer)
          .post("/api/progress")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ log_type: "workout_completion", value_json: { workout: "push" } });
        const res = await request(testServer)
          .get("/api/progress?log_type=weight")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(1);
        res.body.data.forEach((log) => expect(log.log_type).toBe("weight"));
      });

      test("supports pagination", async () => {
        await request(testServer)
          .post("/api/progress")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ log_type: "weight", value_json: { weight: 75 } });
        const res = await request(testServer)
          .get("/api/progress?page=1&limit=10")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.pagination).toBeDefined();
        expect(res.body.pagination.page).toBe(1);
        expect(res.body.pagination.limit).toBe(10);
      });

      test("supports date-range filtering", async () => {
        await request(testServer)
          .post("/api/progress")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ log_type: "weight", value_json: { weight: 75 }, logged_at: "2024-01-15T10:00:00.000Z" });
        const res = await request(testServer)
          .get("/api/progress?start_date=2024-01-01T00:00:00.000Z&end_date=2024-12-31T23:59:59.999Z")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(1);
      });

      test("caps limit at 100", async () => {
        const res = await request(testServer)
          .get("/api/progress?limit=200")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.pagination.limit).toBe(100);
      });

      test("isolates data between users", async () => {
        await request(testServer)
          .post("/api/progress")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ log_type: "weight", value_json: { weight: 75 } });
        const resB = await request(testServer)
          .get("/api/progress")
          .set("Authorization", `Bearer ${userBToken}`);
        expect(resB.status).toBe(200);
        expect(resB.body.data.length).toBe(0);
      });
    });

    describe("GET /api/progress/:id", () => {
      test("returns progress log by id", async () => {
        const createRes = await request(testServer)
          .post("/api/progress")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ log_type: "weight", value_json: { weight: 75 } });
        const logId = createRes.body.data.id;
        const res = await request(testServer)
          .get(`/api/progress/${logId}`)
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(logId);
        expect(res.body.data.log_type).toBe("weight");
      });

      test("without auth returns 401", async () => {
        const res = await request(testServer).get("/api/progress/1");
        expect(res.status).toBe(401);
      });

      test("non-existent id returns 404", async () => {
        const res = await request(testServer)
          .get("/api/progress/99999")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("PROGRESS_LOG_NOT_FOUND");
      });

      test("invalid id returns 400", async () => {
        const res = await request(testServer)
          .get("/api/progress/invalid")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(400);
      });

      test("user cannot access other user log", async () => {
        const createRes = await request(testServer)
          .post("/api/progress")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ log_type: "weight", value_json: { weight: 75 } });
        const logId = createRes.body.data.id;
        const res = await request(testServer)
          .get(`/api/progress/${logId}`)
          .set("Authorization", `Bearer ${userBToken}`);
        expect(res.status).toBe(404);
      });
    });

    describe("DELETE /api/progress/:id", () => {
      test("deletes own progress log", async () => {
        const createRes = await request(testServer)
          .post("/api/progress")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ log_type: "weight", value_json: { weight: 75 } });
        const logId = createRes.body.data.id;
        const res = await request(testServer)
          .delete(`/api/progress/${logId}`)
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      test("without auth returns 401", async () => {
        const res = await request(testServer).delete("/api/progress/1");
        expect(res.status).toBe(401);
      });

      test("non-existent id returns 404", async () => {
        const res = await request(testServer)
          .delete("/api/progress/99999")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(404);
      });

      test("invalid id returns 400", async () => {
        const res = await request(testServer)
          .delete("/api/progress/invalid")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(400);
      });

      test("user cannot delete other user log", async () => {
        const createRes = await request(testServer)
          .post("/api/progress")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ log_type: "weight", value_json: { weight: 75 } });
        const logId = createRes.body.data.id;
        const res = await request(testServer)
          .delete(`/api/progress/${logId}`)
          .set("Authorization", `Bearer ${userBToken}`);
        expect(res.status).toBe(404);
      });
    });
  });

  describe("Phase 4A Integration Tests - Weight API", () => {
    beforeEach(() => {
      const db = getDb();
      db.exec("DELETE FROM weight_history");
      db.exec("DELETE FROM profiles");
      db.exec("DELETE FROM calorie_macro_history");
    });

    describe("POST /api/weight", () => {
      test("creates a weight entry", async () => {
        const res = await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 75 });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.weight).toBe(75);
        expect(res.body.data.recorded_at).toBeDefined();
      });

      test("without auth returns 401", async () => {
        const res = await request(testServer).post("/api/weight").send({ weight: 75 });
        expect(res.status).toBe(401);
      });

      test("weight below 30 returns 400", async () => {
        const res = await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 20 });
        expect(res.status).toBe(400);
      });

      test("weight above 300 returns 400", async () => {
        const res = await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 400 });
        expect(res.status).toBe(400);
      });

      test("future recorded_at returns 400", async () => {
        const future = new Date(Date.now() + 86400000).toISOString();
        const res = await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 75, recorded_at: future });
        expect(res.status).toBe(400);
      });

      test("missing weight returns 400", async () => {
        const res = await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({});
        expect(res.status).toBe(400);
      });

      test("sets needs_calorie_recalculation flag when profile exists", async () => {
        await createProfile(userAToken);
        const res = await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 80 });
        expect(res.status).toBe(201);
        const db = getDb();
        const profile = db.prepare("SELECT needs_calorie_recalculation FROM profiles WHERE user_id = ?").get(userIdA);
        expect(profile.needs_calorie_recalculation).toBe(1);
      });

      test("records weight with optional recorded_at", async () => {
        const recordedAt = new Date(Date.now() - 86400000).toISOString();
        const res = await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 75, recorded_at: recordedAt });
        expect(res.status).toBe(201);
        expect(res.body.data.recorded_at).toBeDefined();
      });
    });

    describe("GET /api/weight", () => {
      test("returns weight history for user", async () => {
        await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 75 });
        const res = await request(testServer)
          .get("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        expect(res.body.pagination).toBeDefined();
      });

      test("without auth returns 401", async () => {
        const res = await request(testServer).get("/api/weight");
        expect(res.status).toBe(401);
      });

      test("supports pagination", async () => {
        await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 75 });
        const res = await request(testServer)
          .get("/api/weight?page=1&limit=10")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.pagination).toBeDefined();
        expect(res.body.pagination.page).toBe(1);
        expect(res.body.pagination.limit).toBe(10);
      });

      test("supports date-range filtering", async () => {
        const yesterday = new Date(Date.now() - 86400000).toISOString();
        await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 75, recorded_at: yesterday });
        const res = await request(testServer)
          .get(`/api/weight?start_date=2024-01-01T00:00:00.000Z&end_date=2026-12-31T00:00:00.000Z`)
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(1);
      });

      test("caps limit at 100", async () => {
        const res = await request(testServer)
          .get("/api/weight?limit=200")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.pagination.limit).toBe(100);
      });

      test("isolates data between users", async () => {
        await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 75 });
        const resB = await request(testServer)
          .get("/api/weight")
          .set("Authorization", `Bearer ${userBToken}`);
        expect(resB.status).toBe(200);
        expect(resB.body.data.length).toBe(0);
      });
    });

    describe("GET /api/weight/latest", () => {
      test("returns latest weight entry", async () => {
        await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 75 });
        await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 74 });
        const res = await request(testServer)
          .get("/api/weight/latest")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.weight).toBe(74);
      });

      test("without auth returns 401", async () => {
        const res = await request(testServer).get("/api/weight/latest");
        expect(res.status).toBe(401);
      });

      test("404 when no weight entries exist", async () => {
        const res = await request(testServer)
          .get("/api/weight/latest")
          .set("Authorization", `Bearer ${userBToken}`);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("WEIGHT_NOT_FOUND");
      });
    });

    describe("GET /api/weight/trend", () => {
      test("returns trend with default 30 days", async () => {
        await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 75 });
        const res = await request(testServer)
          .get("/api/weight/trend")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.period_days).toBe(30);
        expect(res.body.data.entries).toBeGreaterThanOrEqual(1);
      });

      test("supports 7-day trend", async () => {
        await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 75 });
        const res = await request(testServer)
          .get("/api/weight/trend?days=7")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.period_days).toBe(7);
      });

      test("supports 90-day trend", async () => {
        await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 75 });
        const res = await request(testServer)
          .get("/api/weight/trend?days=90")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.period_days).toBe(90);
      });

      test("without auth returns 401", async () => {
        const res = await request(testServer).get("/api/weight/trend");
        expect(res.status).toBe(401);
      });
    });

    describe("DELETE /api/weight/:id", () => {
      test("deletes own weight entry", async () => {
        const createRes = await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 75 });
        const weightId = createRes.body.data.id;
        const res = await request(testServer)
          .delete(`/api/weight/${weightId}`)
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      test("without auth returns 401", async () => {
        const res = await request(testServer).delete("/api/weight/1");
        expect(res.status).toBe(401);
      });

      test("non-existent id returns 404", async () => {
        const res = await request(testServer)
          .delete("/api/weight/99999")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("WEIGHT_NOT_FOUND");
      });

      test("invalid id returns 400", async () => {
        const res = await request(testServer)
          .delete("/api/weight/invalid")
          .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(400);
      });

      test("does not clear needs_calorie_recalculation flag on delete", async () => {
        await createProfile(userAToken);
        const createRes = await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 80 });
        const weightId = createRes.body.data.id;
        const db = getDb();
        const before = db.prepare("SELECT needs_calorie_recalculation FROM profiles WHERE user_id = ?").get(userIdA);
        expect(before.needs_calorie_recalculation).toBe(1);
        await request(testServer)
          .delete(`/api/weight/${weightId}`)
          .set("Authorization", `Bearer ${userAToken}`);
        const after = db.prepare("SELECT needs_calorie_recalculation FROM profiles WHERE user_id = ?").get(userIdA);
        expect(after.needs_calorie_recalculation).toBe(1);
      });

      test("user cannot delete other user entry", async () => {
        const createRes = await request(testServer)
          .post("/api/weight")
          .set("Authorization", `Bearer ${userAToken}`)
          .send({ weight: 75 });
        const weightId = createRes.body.data.id;
        const res = await request(testServer)
          .delete(`/api/weight/${weightId}`)
          .set("Authorization", `Bearer ${userBToken}`);
        expect(res.status).toBe(404);
      });
    });
  });

  describe("Phase 4B Integration Tests - Adherence API", () => {
    const DIET_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const GYM_FOCUSES = { Mon: "push", Tue: "pull", Wed: "legs", Thu: "push", Fri: "pull", Sat: "cardio", Sun: "rest" };

    function mondayOffset(weeks) {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      const day = d.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setUTCDate(d.getUTCDate() + diff + weeks * 7);
      return d;
    }
    function isoDate(d) {
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
    }
    function addDaysUTC(d, n) {
      const x = new Date(d);
      x.setUTCDate(x.getUTCDate() + n);
      return x;
    }
    function dietJson(mealsPerDay) {
      return {
        weekly_plan: DIET_DAYS.map((day) => ({
          day,
          meals: Array.from({ length: mealsPerDay }, (_, i) => ({ name: day + "_" + i, calories: 500 })),
        })),
      };
    }
    function gymJson() {
      return {
        weekly_plan: DIET_DAYS.map((day) => ({
          day,
          focus: GYM_FOCUSES[day],
          exercises: [{ name: day + "_ex", sets: 3 }],
        })),
      };
    }
    function insertPlan(table, jsonField, userId, plan, gen, validUntil) {
      const db = getDb();
      db.prepare(
        `INSERT INTO ${table} (user_id, ${jsonField}, generated_at, valid_until) VALUES (?, ?, ?, ?)`
      ).run(userId, JSON.stringify(plan), gen, validUntil);
    }
    function insertLog(userId, logType, valueJson, loggedAt) {
      const db = getDb();
      db.prepare(
        "INSERT INTO progress_logs (user_id, log_type, value_json, logged_at) VALUES (?, ?, ?, ?)"
      ).run(userId, logType, JSON.stringify(valueJson), loggedAt);
    }

    beforeEach(() => {
      const db = getDb();
      db.exec("DELETE FROM progress_logs");
      db.exec("DELETE FROM diet_plans");
      db.exec("DELETE FROM gym_plans");
    });

    test("GET /api/adherence/weekly without auth returns 401", async () => {
      const res = await request(testServer).get("/api/adherence/weekly");
      expect(res.status).toBe(401);
    });

    test("GET /api/adherence/summary without auth returns 401", async () => {
      const res = await request(testServer).get("/api/adherence/summary");
      expect(res.status).toBe(401);
    });

    test("GET /api/adherence/weekly with no plans returns null adherence", async () => {
      const res = await request(testServer)
        .get("/api/adherence/weekly")
        .set("Authorization", `Bearer ${userAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.overall.overall_adherence_percentage).toBeNull();
      expect(res.body.data.diet.adherence_percentage).toBeNull();
      expect(res.body.data.gym.adherence_percentage).toBeNull();
    });

    test("GET /api/adherence/weekly returns current week structure", async () => {
      const currentMon = mondayOffset(0);
      const validUntil = isoDate(addDaysUTC(currentMon, 7)) + "T00:00:00.000Z";
      insertPlan("diet_plans", "meals_json", userIdA, dietJson(4), isoDate(currentMon) + "T00:00:00.000Z", validUntil);
      insertPlan("gym_plans", "workouts_json", userIdA, gymJson(), isoDate(currentMon) + "T00:00:00.000Z", validUntil);

      const res = await request(testServer)
        .get("/api/adherence/weekly")
        .set("Authorization", `Bearer ${userAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.week_start).toBe(isoDate(currentMon));
      expect(res.body.data.is_partial_week).toBe(true);
      expect(res.body.data.days_in_period).toBeGreaterThanOrEqual(1);
      expect(res.body.data.days_in_period).toBeLessThanOrEqual(7);
      expect(Array.isArray(res.body.data.diet)).toBe(false);
    });

    test("GET /api/adherence/weekly with invalid week_start format returns 400", async () => {
      const res = await request(testServer)
        .get("/api/adherence/weekly?week_start=invalid")
        .set("Authorization", `Bearer ${userAToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.fields.week_start).toBeDefined();
    });

    test("GET /api/adherence/weekly with non-Monday week_start returns 400", async () => {
      const res = await request(testServer)
        .get("/api/adherence/weekly?week_start=2024-01-16")
        .set("Authorization", `Bearer ${userAToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    test("GET /api/adherence/weekly with specified week counts adherence", async () => {
      const weekMon = mondayOffset(-2);
      const weekStartStr = isoDate(weekMon);
      const validUntil = isoDate(addDaysUTC(weekMon, 7)) + "T00:00:00.000Z";
      insertPlan("diet_plans", "meals_json", userIdA, dietJson(4), weekStartStr + "T00:00:00.000Z", validUntil);
      insertPlan("gym_plans", "workouts_json", userIdA, gymJson(), weekStartStr + "T00:00:00.000Z", validUntil);

      const days = [];
      for (let i = 0; i < 7; i++) days.push(isoDate(addDaysUTC(weekMon, i)));
      days.forEach((d) => {
        insertLog(userIdA, "meal_compliance", {}, d + "T08:00:00.000Z");
        insertLog(userIdA, "meal_compliance", {}, d + "T12:00:00.000Z");
      });
      days.forEach((d, i) => {
        if (i < 3) insertLog(userIdA, "workout_completion", { workout_completed: true }, d + "T18:00:00.000Z");
      });

      const res = await request(testServer)
        .get(`/api/adherence/weekly?week_start=${weekStartStr}`)
        .set("Authorization", `Bearer ${userAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.diet.adherence_percentage).toBe(50);
      expect(res.body.data.diet.meals_hit).toBe(14);
      expect(res.body.data.diet.meals_expected).toBe(28);
      expect(res.body.data.gym.adherence_percentage).toBe(50);
      expect(res.body.data.gym.workouts_completed).toBe(3);
      expect(res.body.data.gym.workouts_expected).toBe(6);
      expect(res.body.data.overall.overall_adherence_percentage).toBe(50);
    });

    test("GET /api/adherence/summary with invalid weeks returns 400", async () => {
      const res = await request(testServer)
        .get("/api/adherence/summary?weeks=5")
        .set("Authorization", `Bearer ${userAToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    test("GET /api/adherence/summary returns weeks array", async () => {
      const res = await request(testServer)
        .get("/api/adherence/summary?weeks=4")
        .set("Authorization", `Bearer ${userAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.range_weeks).toBe(4);
      expect(Array.isArray(res.body.data.weeks)).toBe(true);
      expect(res.body.data.weeks.length).toBe(4);
      expect(res.body.data.averages).toBeDefined();
    });

    test("user isolation: user B does not see user A adherence data", async () => {
      const weekMon = mondayOffset(-2);
      const weekStartStr = isoDate(weekMon);
      const validUntil = isoDate(addDaysUTC(weekMon, 7)) + "T00:00:00.000Z";
      insertPlan("diet_plans", "meals_json", userIdA, dietJson(4), weekStartStr + "T00:00:00.000Z", validUntil);
      insertPlan("gym_plans", "workouts_json", userIdA, gymJson(), weekStartStr + "T00:00:00.000Z", validUntil);

      const days = [];
      for (let i = 0; i < 7; i++) days.push(isoDate(addDaysUTC(weekMon, i)));
      days.forEach((d) => insertLog(userIdA, "meal_compliance", { meals_hit: 4 }, d + "T08:00:00.000Z"));
      days.forEach((d, i) => {
        if (i < 6) insertLog(userIdA, "workout_completion", { workout_completed: true }, d + "T18:00:00.000Z");
      });

      const resA = await request(testServer)
        .get(`/api/adherence/weekly?week_start=${weekStartStr}`)
        .set("Authorization", `Bearer ${userAToken}`);
      const resB = await request(testServer)
        .get(`/api/adherence/weekly?week_start=${weekStartStr}`)
        .set("Authorization", `Bearer ${userBToken}`);
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(resA.body.data.diet.adherence_percentage).toBe(100);
      expect(resB.body.data.diet.adherence_percentage).toBeNull();
      expect(resB.body.data.diet.message).toMatch(/No diet plan/);
    });
  });
});
