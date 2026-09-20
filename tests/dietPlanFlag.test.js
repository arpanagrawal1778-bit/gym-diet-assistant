const request = require("supertest");
const { setupTestDb, teardownTestDb } = require("./setup");
const { app } = require("../src/server");
const { getDb } = require("../src/config/database");
const dietPlanService = require("../src/services/dietPlanService");
const llmService = require("../src/services/llmService");

let testServer;
let userToken;
let userId;

beforeAll(async () => {
  setupTestDb();
  await new Promise(resolve => {
    testServer = app.listen(0, resolve);
  });
  
  const res = await request(testServer)
    .post("/api/auth/signup")
    .send({ name: "Flag User", email: "flag@test.com", password: "password123" });
    
  if (res.status !== 201) {
    throw new Error("Failed to register test user: " + JSON.stringify(res.body));
  }
  
  userId = res.body.data.user.id;
  userToken = res.body.data.token;
});

afterAll(async () => {
  await new Promise(resolve => testServer.close(resolve));
  teardownTestDb();
  jest.restoreAllMocks();
});

beforeEach(async () => {
  const db = getDb();
  db.exec("DELETE FROM profiles");
  db.exec("DELETE FROM diet_plans");
  
  const profileRes = await request(testServer)
    .post("/api/profile")
    .set("Authorization", `Bearer ${userToken}`)
    .send({
      age: 30,
      gender: "male",
      height: 180,
      weight: 80,
      activity_level: "active",
      fitness_goal: "maintain",
      diet_preference: "vegetarian",
      monthly_diet_budget: 300,
      gym_experience_level: "beginner"
    });
    
  if (profileRes.status !== 201) {
    throw new Error("Failed to create profile: " + JSON.stringify(profileRes.body));
  }
    
  db.prepare("UPDATE profiles SET needs_diet_regeneration = 1 WHERE user_id = ?").run(userId);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Diet Plan Flag Tests", () => {
  test("successful LLM generation clears the flag", async () => {
    jest.spyOn(llmService, "isConfigured").mockReturnValue(true);
    jest.spyOn(llmService, "callLLM").mockResolvedValue('{"weekly_plan":[]}');
    jest.spyOn(llmService, "parseLlmJson").mockResolvedValue({ 
      weekly_plan: [
        {
          day: "Mon",
          meals: [
            { name: "Oats", calories: 300, protein_grams: 10, carbs_grams: 50, fat_grams: 5, timing: "Breakfast" }
          ]
        }
      ] 
    });
    
    const res = await request(testServer)
      .post("/api/plans/diet")
      .set("Authorization", `Bearer ${userToken}`);
      
    expect(res.status).toBe(201);
    
    const db = getDb();
    const profile = db.prepare("SELECT needs_diet_regeneration FROM profiles WHERE user_id = ?").get(userId);
    expect(profile.needs_diet_regeneration).toBe(0);
  });
  
  test("successful rule_based generation clears the flag", async () => {
    jest.spyOn(llmService, "isConfigured").mockReturnValue(false); // Forces rule_based
    
    const res = await request(testServer)
      .post("/api/plans/diet")
      .set("Authorization", `Bearer ${userToken}`);
      
    expect(res.status).toBe(201);
    
    const db = getDb();
    const profile = db.prepare("SELECT needs_diet_regeneration FROM profiles WHERE user_id = ?").get(userId);
    expect(profile.needs_diet_regeneration).toBe(0);
  });

  test("rule-based fallback still works and failed generation does not incorrectly clear the flag", async () => {
    jest.spyOn(llmService, "isConfigured").mockReturnValue(true);
    jest.spyOn(llmService, "callLLM").mockRejectedValue(new Error("LLM Error")); // Forces fallback
    
    const db = getDb();
    const res = await request(testServer)
      .post("/api/plans/diet")
      .set("Authorization", `Bearer ${userToken}`);
      
    expect(res.status).toBe(201);
    
    const profile = db.prepare("SELECT needs_diet_regeneration FROM profiles WHERE user_id = ?").get(userId);
    // Flag should REMAIN 1 because LLM failed
    expect(profile.needs_diet_regeneration).toBe(1);
  });
});
