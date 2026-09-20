const zod = require("zod");


/* =========================================================
   ENUMS
========================================================= */

const genderEnum = zod.enum(
  ["male", "female", "other"],
  {
    errorMap: () => ({
      message:
        "Gender must be male, female, or other",
    }),
  }
);

const activityLevelEnum = zod.enum(
  [
    "sedentary",
    "light",
    "moderate",
    "active",
    "very_active",
  ],
  {
    errorMap: () => ({
      message:
        "Activity level must be sedentary, light, moderate, active, or very_active",
    }),
  }
);

const fitnessGoalEnum = zod.enum(
  [
    "cut",
    "bulk",
    "maintain",
    "recomp",
  ],
  {
    errorMap: () => ({
      message:
        "Fitness goal must be cut, bulk, maintain, or recomp",
    }),
  }
);


/* =========================================================
   NEW: DIET PREFERENCE
========================================================= */

const dietPreferenceEnum = zod.enum(
  [
    "vegetarian",
    "non_vegetarian",
  ],
  {
    errorMap: () => ({
      message:
        "Diet preference must be vegetarian or non_vegetarian",
    }),
  }
);


const gymExperienceEnum = zod.enum(
  [
    "none",
    "beginner",
    "intermediate",
    "advanced",
  ],
  {
    errorMap: () => ({
      message:
        "Gym experience must be none, beginner, intermediate, or advanced",
    }),
  }
);

const injuryCategoryEnum = zod.enum(
  [
    "knee",
    "shoulder",
    "back",
    "ankle",
    "wrist",
    "elbow",
    "hip",
    "neck",
    "other",
  ],
  {
    errorMap: () => ({
      message:
        "Injury category must be knee, shoulder, back, ankle, wrist, elbow, hip, neck, or other",
    }),
  }
);

const collegeDayEnum = zod.enum(
  [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ],
  {
    errorMap: () => ({
      message:
        "College day must be one of Mon, Tue, Wed, Thu, Fri, Sat, Sun",
    }),
  }
);

const logTypeEnum = zod.enum(
  [
    "weight",
    "workout_completion",
    "meal_compliance",
    "measurement",
    "progress_photo",
    "custom",
  ],
  {
    errorMap: () => ({
      message:
        "Invalid log type",
    }),
  }
);


/* =========================================================
   BASIC SCHEMAS
========================================================= */

const emailSchema =
  zod
    .string()
    .email("Invalid email format")
    .min(3, "Email is too short")
    .max(254, "Email is too long");

const nameSchema =
  zod
    .string()
    .min(1, "Name is required")
    .max(100, "Name is too long")
    .trim();

const passwordSchema =
  zod
    .string()
    .min(
      6,
      "Password must be at least 6 characters"
    )
    .max(
      128,
      "Password is too long"
    );


/* =========================================================
   AUTH
========================================================= */

const signupSchema = zod.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

const loginSchema = zod.object({
  email: emailSchema,
  password: zod
    .string()
    .min(1, "Password is required"),
});


/* =========================================================
   TIME
========================================================= */

const timeSchema =
  zod
    .string()
    .regex(
      /^([01]?\d|2[0-3]):[0-5]\d$/,
      "Time must be in HH:MM format (e.g. 09:00)"
    );


/* =========================================================
   PROFILE
========================================================= */

const profileSchema = zod
  .object({

    gender:
      genderEnum,

    age:
      zod
        .number(
          "Age must be a number"
        )
        .int(
          "Age must be an integer"
        )
        .min(
          13,
          "Age must be between 13 and 100"
        )
        .max(
          100,
          "Age must be between 13 and 100"
        ),

    height:
      zod
        .number(
          "Height must be a number"
        )
        .min(
          100,
          "Height must be between 100 and 250 cm"
        )
        .max(
          250,
          "Height must be between 100 and 250 cm"
        ),

    weight:
      zod
        .number(
          "Weight must be a number"
        )
        .min(
          30,
          "Weight must be between 30 and 300 kg"
        )
        .max(
          300,
          "Weight must be between 30 and 300 kg"
        ),

    activity_level:
      activityLevelEnum,

    fitness_goal:
      fitnessGoalEnum,

    /* ============================================
       NEW FIELD
    ============================================ */

    diet_preference:
      dietPreferenceEnum,

    target_body_description:
      zod
        .string()
        .max(
          500,
          "Target body description must be at most 500 characters"
        )
        .optional()
        .default(""),

    monthly_diet_budget:
      zod
        .number(
          "Budget must be a number"
        )
        .min(
          0.01,
          "Monthly diet budget must be greater than 0"
        ),

    college_start_time:
      timeSchema
        .optional()
        .nullable(),

    college_end_time:
      timeSchema
        .optional()
        .nullable(),

    college_days:
      zod
        .array(collegeDayEnum)
        .optional()
        .default([]),

    allergies:
      zod
        .array(
          zod
            .string()
            .min(1)
            .max(50)
        )
        .optional()
        .default([]),

    injuries:
      zod
        .array(
          zod.object({
            category:
              injuryCategoryEnum,

            detail:
              zod
                .string()
                .min(
                  1,
                  "Injury detail is required"
                )
                .max(
                  300,
                  "Injury detail is too long"
                ),
          })
        )
        .optional()
        .default([]),

    gym_experience_level:
      gymExperienceEnum,

    gym_experience_note:
      zod
        .string()
        .max(
          500,
          "Gym experience note is too long"
        )
        .optional()
        .default(""),

    meal_reminders:
      zod.boolean().optional(),

    workout_reminders:
      zod.boolean().optional(),
  })
  .refine(
    (data) => {

      if (
        data.college_start_time &&
        data.college_end_time
      ) {
        return (
          data.college_end_time >
          data.college_start_time
        );
      }

      return true;
    },
    {
      message:
        "College end time must be after college start time",
      path: [
        "college_end_time",
      ],
    }
  );


/* =========================================================
   PROGRESS
========================================================= */

const progressSchema =
  zod.object({

    log_type:
      logTypeEnum,

    value_json:
      zod
        .record(zod.unknown())
        .refine(
          (val) =>
            Object.keys(val).length > 0,
          {
            message:
              "value_json must be a non-empty object",
          }
        ),

    logged_at:
      zod
        .string()
        .datetime({
          offset: true,
        })
        .optional(),
  });


/* =========================================================
   WEIGHT
========================================================= */

const weightSchema =
  zod.object({

    weight:
      zod
        .number(
          "Weight must be a number"
        )
        .min(
          30,
          "Weight must be between 30 and 300 kg"
        )
        .max(
          300,
          "Weight must be between 30 and 300 kg"
        ),

    recorded_at:
      zod
        .string()
        .datetime({
          offset: true,
        })
        .optional(),
  });


/* =========================================================
   REMINDERS
========================================================= */

const reminderPreferencesSchema =
  zod
    .object({

      meal_reminders:
        zod.boolean(),

      workout_reminders:
        zod.boolean(),

      weight_checkin_day:
        zod.enum([
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
          "Sun",
        ]),

      progress_photo_frequency:
        zod.enum([
          "weekly",
          "biweekly",
          "monthly",
        ]),

      plan_expiry_warning_days:
        zod
          .number()
          .int()
          .min(0),

      reminder_time:
        zod
          .string()
          .regex(
            /^([01]?\d|2[0-3]):[0-5]\d$/,
            "Time must be in HH:MM format"
          ),
    })
    .refine(
      (data) => true,
      {
        message:
          "Invalid reminder preferences",
      }
    );


/* =========================================================
   ERROR FORMATTER
========================================================= */

function formatZodError(error) {

  const fields = {};

  for (const issue of error.issues) {

    const path =
      issue.path.length > 0
        ? issue.path.join(".")
        : "general";

    fields[path] =
      issue.message;
  }

  return fields;
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  signupSchema,
  loginSchema,
  profileSchema,
  progressSchema,
  weightSchema,

  formatZodError,

  genderEnum,
  activityLevelEnum,
  fitnessGoalEnum,

  /* NEW */
  dietPreferenceEnum,

  gymExperienceEnum,
  injuryCategoryEnum,
  collegeDayEnum,
  logTypeEnum,

  reminderPreferencesSchema,
};