const env = require("../config/env");
const { EXERCISES } = require("../constants/exercises");
const { GoogleGenAI } = require("@google/genai");


/* =========================================================
   CONFIGURATION
========================================================= */

function isConfigured() {
  return Boolean(env.llmApiKey);
}


/* =========================================================
   DIET PLAN PROMPT
========================================================= */

function buildDietPlanPrompt(
  profile,
  calculation,
  allergies,
  budget,
  fitnessGoal
) {
  const safeAllergies =
    Array.isArray(allergies) &&
      allergies.length > 0
      ? allergies.join(", ")
      : "none";

  const dietPreference =
    profile.diet_preference === "non_vegetarian"
      ? "Non-Vegetarian"
      : "Vegetarian";

  const dietRules =
    profile.diet_preference === "non_vegetarian"
      ? [
        "Non-vegetarian meals are allowed.",
        "Meat, chicken, fish, eggs and seafood may be used when appropriate.",
        "Still strictly avoid every listed allergy.",
      ]
      : [
        "STRICTLY VEGETARIAN.",
        "Do NOT include meat.",
        "Do NOT include chicken.",
        "Do NOT include fish.",
        "Do NOT include seafood or shellfish.",
        "Do NOT include eggs.",
        "Dairy products are allowed unless the user lists dairy or milk as an allergy.",
        "WARNING: The application uses a strict substring validator. Do NOT use the exact words 'meat', 'egg', 'chicken', 'fish', 'ham', or 'seafood' anywhere in the response, not even as part of other words (e.g. avoid 'meatless', 'eggplant', 'hamburger'). Use safe alternatives like 'plant-based', 'aubergine', or 'veggie patty'.",
      ];

  return [
    "You are generating a personalized weekly meal plan for a fitness application.",

    "",

    "Return ONLY a valid JSON object in exactly this structure:",

    "{",
    '  "weekly_plan": [',
    "    {",
    '      "day": "Mon",',
    '      "meals": [',
    "        {",
    '          "name": "Breakfast meal name",',
    '          "description": "Short description",',
    '          "calories": 0,',
    '          "protein_grams": 0,',
    '          "carbs_grams": 0,',
    '          "fat_grams": 0,',
    '          "ingredients": ["ingredient 1", "ingredient 2"]',
    "        }",
    "      ]",
    "    }",
    "  ]",
    "}",

    "",

    "Generate exactly 7 days: Mon, Tue, Wed, Thu, Fri, Sat, Sun.",
    "Each day must contain exactly 4 meals: breakfast, lunch, dinner, snack.",

    "",

    `Daily calorie target: ${Math.round(
      calculation.calorie_target
    )} kcal`,

    `Daily macronutrients: P=${Math.round(
      calculation.protein_grams
    )}g C=${Math.round(
      calculation.carbs_grams
    )}g F=${Math.round(
      calculation.fat_grams
    )}g`,

    `Fitness goal: ${fitnessGoal}`,
    `Age: ${profile.age}`,
    `Weight: ${profile.weight} kg`,
    `Height: ${profile.height} cm`,
    `Gender: ${profile.gender}`,
    `Activity level: ${profile.activity_level}`,
    `Diet preference: ${dietPreference}`,
    `Monthly diet budget: ${budget} currency units`,
    `Foods and ingredients to strictly avoid: ${safeAllergies}`,

    "",

    "DIET PREFERENCE RULES:",

    `Selected diet preference: ${dietPreference}`,

    ...dietRules,

    "",

    "STRICT ALLERGY RULES:",
    "1. Never include an avoided food in the meal name.",
    "2. Never include an avoided food in the meal description.",
    "3. Never include an avoided food in the ingredients array.",
    "4. Treat common spelling mistakes and obvious variations as the same food.",
    "5. If an avoided food appears in a possible meal, replace that meal with a safe alternative.",
    "6. Check every meal against every listed allergy before returning the final JSON.",

    "",

    "MEAL VARIETY RULES:",
    "Avoid repeating the same meal on consecutive days.",
    "Provide reasonable variety throughout the week.",

    "",

    "BUDGET RULE:",
    "Keep the daily meal plan affordable within the supplied monthly budget.",

    "",

    "CALORIE RULE:",
    "Keep total daily calories within approximately 10% of the calorie target.",

    "",

    "FINAL CHECK BEFORE RESPONSE:",
    "Verify diet preference.",
    "Verify all allergies.",
    "Verify every meal's ingredients.",
    "Verify the 7-day structure.",
    "Verify exactly 4 meals per day.",

    "",

    "IMPORTANT:",
    "Return ONLY valid JSON.",
    "Do not include markdown.",
    "Do not include ```json.",
    "Do not include explanations before or after the JSON.",
  ].join("\n");
}


/* =========================================================
   GYM EXERCISE CATALOG
========================================================= */

function buildExerciseCatalog() {
  return EXERCISES
    .map((exercise) => {
      const muscles = Array.isArray(
        exercise.muscle_groups
      )
        ? exercise.muscle_groups.join(", ")
        : "";

      return [
        `Name: ${exercise.name}`,
        `Category: ${exercise.category}`,
        `Muscles: ${muscles}`,
        `Difficulty: ${exercise.difficulty}`,
        `Description: ${exercise.description}`,
      ].join(" | ");
    })
    .join("\n");
}


/* =========================================================
   GYM PLAN PROMPT
========================================================= */

function buildGymPlanPrompt(
  profile,
  fitnessGoal,
  injuries
) {
  const injurySummary =
    Array.isArray(injuries) &&
      injuries.length > 0
      ? injuries
        .map((injury) => {
          if (typeof injury === "string") {
            return injury;
          }

          return `${injury.category}: ${injury.detail || "unspecified"
            }`;
        })
        .join("; ")
      : "none";

  const exerciseCatalog =
    buildExerciseCatalog();

  return [
    "You are generating a personalized weekly workout plan for a fitness application.",
    "",
    "The user has provided a fitness goal, experience level and injury information.",
    "Create a reasonable, progressive and safe weekly routine.",
    "",
    "RETURN ONLY A VALID JSON OBJECT IN THIS EXACT STRUCTURE:",
    "",
    "{",
    '  "weekly_plan": [',
    "    {",
    '      "day": "Mon",',
    '      "focus": "push",',
    '      "exercises": [',
    "        {",
    '          "name": "Push-ups",',
    '          "sets": 2,',
    '          "reps": "10-15",',
    '          "description": "Short exercise description"',
    "        }",
    "      ]",
    "    }",
    "  ]",
    "}",
    "",
    "WEEK STRUCTURE:",
    "1. Generate exactly 7 days.",
    "2. Use these day names exactly: Mon, Tue, Wed, Thu, Fri, Sat, Sun.",
    "3. Each day must contain a focus and an exercises array.",
    "4. Include at least 1 rest or recovery day.",
    "5. Do not create duplicate day names.",
    "",
    "ALLOWED FOCUS VALUES:",
    "push",
    "pull",
    "legs",
    "cardio",
    "rest",
    "recovery",
    "",
    "EXERCISE RULE:",
    "You MUST use exercise names from the approved exercise catalog below.",
    "Do NOT invent new exercise names.",
    "Do NOT rename exercises.",
    "Use the exact exercise name from the catalog.",
    "",
    "APPROVED EXERCISE CATALOG:",
    exerciseCatalog,
    "",
    "USER INFORMATION:",
    `Fitness goal: ${fitnessGoal}`,
    `Gym experience level: ${profile.gym_experience_level || "beginner"
    }`,
    `Activity level: ${profile.activity_level || "unknown"
    }`,
    `Age: ${profile.age || "unknown"}`,
    `Weight: ${profile.weight || "unknown"} kg`,
    `Height: ${profile.height || "unknown"} cm`,
    `Reported injuries: ${injurySummary}`,
    "",
    "INJURY SAFETY RULES:",
    "1. Never assign an exercise that conflicts with a reported injury.",
    "2. If a user has a shoulder injury, avoid exercises marked as unsafe for shoulder injuries.",
    "3. If a user has a wrist injury, avoid exercises marked as unsafe for wrist injuries.",
    "4. If a user has a knee injury, avoid exercises marked as unsafe for knee injuries.",
    "5. If a user has an ankle injury, avoid exercises marked as unsafe for ankle injuries.",
    "6. If a user has a back injury, avoid exercises marked as unsafe for back injuries.",
    "7. Do not assume that an exercise is safe merely because the injury was not explicitly mentioned.",
    "8. When injury information is present, use only the approved catalog so the application can verify exercise safety.",
    "",
    "EXPERIENCE RULES:",
    "For beginners or users with no gym experience, prefer beginner exercises and modest sets and repetitions.",
    "For intermediate users, moderate progression is appropriate.",
    "For advanced users, advanced exercises may be used only when they are present in the approved catalog.",
    "",
    "WORKOUT RULES:",
    "1. Keep workouts practical and manageable.",
    "2. Do not prescribe excessive daily exercise volume.",
    "3. Include recovery days.",
    "4. Do not include exercises that conflict with reported injuries.",
    "5. Sets should be numeric.",
    "6. Reps should be a simple range such as '8-12' or a duration such as '5-10 minutes'.",
    "7. Description should briefly explain the movement.",
    "",
    "FINAL VALIDATION:",
    "Before returning the JSON, verify:",
    "- Exactly 7 days exist.",
    "- Day names are unique and valid.",
    "- At least 1 day is rest or recovery.",
    "- Every exercise name exactly matches the approved catalog.",
    "- No exercise conflicts with reported injuries.",
    "- Every exercise has name, sets, reps and description.",
    "",
    "IMPORTANT:",
    "Return ONLY JSON.",
    "Do not use markdown.",
    "Do not use ```json.",
    "Do not add explanations before or after the JSON.",
  ].join("\n");
}


/* =========================================================
   CALL LLM
========================================================= */

async function callLLM(
  prompt,
  options = {}
) {
  const client = new GoogleGenAI({ apiKey: env.llmApiKey });
  const interaction = await client.interactions.create({
    model: env.llmModel,
    input: prompt,
    generation_config: {
      temperature:
        options.temperature !== undefined
          ? options.temperature
          : 0.7,
    },
    response_format: {
      type: "text",
      mime_type: "application/json"
    }
  });

  if (!interaction.output_text) {
    throw new Error("LLM returned no content");
  }

  return interaction.output_text.trim();
}


/* =========================================================
   PARSE LLM JSON
========================================================= */

async function parseLlmJson(rawContent) {
  if (
    typeof rawContent !== "string" ||
    rawContent.trim() === ""
  ) {
    throw new Error(
      "LLM response was empty"
    );
  }

  let jsonStr =
    rawContent.trim();

  // Remove markdown code fences if the model
  // ignores the JSON-only instruction.
  if (
    jsonStr.startsWith("```json")
  ) {
    jsonStr =
      jsonStr.slice(7);
  }

  if (
    jsonStr.startsWith("```")
  ) {
    jsonStr =
      jsonStr.slice(3);
  }

  if (
    jsonStr.endsWith("```")
  ) {
    jsonStr =
      jsonStr.slice(0, -3);
  }

  jsonStr =
    jsonStr.trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    // Continue with extraction below.
  }

  const firstBrace =
    jsonStr.indexOf("{");

  const firstBracket =
    jsonStr.indexOf("[");

  let start = -1;
  let openChar = "";
  let closeChar = "";

  if (
    firstBrace !== -1 &&
    (
      firstBracket === -1 ||
      firstBrace < firstBracket
    )
  ) {
    start = firstBrace;
    openChar = "{";
    closeChar = "}";
  } else if (
    firstBracket !== -1
  ) {
    start = firstBracket;
    openChar = "[";
    closeChar = "]";
  }

  if (start !== -1) {
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let end = -1;

    for (
      let i = start;
      i < jsonStr.length;
      i++
    ) {
      const ch =
        jsonStr[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (
        ch === "\\" &&
        inString
      ) {
        escapeNext = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (ch === openChar) {
        depth++;
      }

      if (ch === closeChar) {
        depth--;

        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end !== -1) {
      const extracted =
        jsonStr.slice(
          start,
          end + 1
        );

      try {
        return JSON.parse(extracted);
      } catch {
        // Fall through to the final error.
      }
    }
  }

  throw new Error(
    "Failed to parse LLM response as JSON"
  );
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  isConfigured,
  callLLM,
  parseLlmJson,
  buildDietPlanPrompt,
  buildGymPlanPrompt,
};