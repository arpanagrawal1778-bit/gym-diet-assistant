const EXERCISES = Object.freeze([
  {
    name: "Push-ups",
    description: "Classic push-up targeting chest, shoulders, and triceps",
    category: "strength",
    muscle_groups: ["chest", "shoulders", "triceps"],
    difficulty: "beginner",
    injuries_to_avoid: ["shoulder", "wrist"],
  },

  {
    name: "Bodyweight Squats",
    description: "Air squats targeting quadriceps, glutes, and hamstrings",
    category: "strength",
    muscle_groups: ["quadriceps", "glutes", "hamstrings"],
    difficulty: "beginner",
    injuries_to_avoid: ["knee", "ankle"],
  },

  {
    name: "Plank",
    description: "Core stability hold targeting abs and lower back",
    category: "strength",
    muscle_groups: ["core", "abs", "lower_back"],
    difficulty: "beginner",
    injuries_to_avoid: ["back"],
  },

  {
    name: "Bent-over Rows",
    description: "Barbell or dumbbell row targeting back and biceps",
    category: "strength",
    muscle_groups: ["back", "biceps"],
    difficulty: "intermediate",
    injuries_to_avoid: ["back"],
  },

  {
    name: "Deadlifts",
    description: "Barbell deadlift targeting posterior chain",
    category: "strength",
    muscle_groups: ["back", "glutes", "hamstrings"],
    difficulty: "intermediate",
    injuries_to_avoid: ["back", "knee"],
  },

  {
    name: "Overhead Press",
    description: "Shoulder press targeting deltoids and triceps",
    category: "strength",
    muscle_groups: ["shoulders", "triceps"],
    difficulty: "intermediate",
    injuries_to_avoid: ["shoulder", "wrist"],
  },

  {
    name: "Pull-ups",
    description: "Vertical pull targeting latissimus dorsi and biceps",
    category: "strength",
    muscle_groups: ["back", "lats", "biceps"],
    difficulty: "intermediate",
    injuries_to_avoid: ["shoulder", "wrist"],
  },

  {
    name: "Lunges",
    description: "Walking or stationary lunges targeting legs and glutes",
    category: "strength",
    muscle_groups: ["quadriceps", "glutes", "hamstrings"],
    difficulty: "beginner",
    injuries_to_avoid: ["knee", "ankle"],
  },

  {
    name: "Dumbbell Shoulder Press",
    description: "Seated or standing shoulder press with dumbbells",
    category: "strength",
    muscle_groups: ["shoulders", "triceps"],
    difficulty: "beginner",
    injuries_to_avoid: ["shoulder"],
  },

  {
    name: "Bird Dog",
    description: "Core stability exercise on hands and knees",
    category: "strength",
    muscle_groups: ["core"],
    difficulty: "beginner",
    injuries_to_avoid: [],
  },

  {
    name: "Cat-Cow Stretch",
    description: "Gentle spinal mobility stretch",
    category: "flexibility",
    muscle_groups: ["spine", "core"],
    difficulty: "beginner",
    injuries_to_avoid: ["back"],
  },

  {
    name: "Hip Thrusts",
    description: "Glute activation exercise with focus on posterior chain",
    category: "strength",
    muscle_groups: ["glutes", "hamstrings"],
    difficulty: "intermediate",
    injuries_to_avoid: ["back"],
  },

  {
    name: "Face Pulls",
    description: "Rear deltoid and upper back exercise with cable or band",
    category: "strength",
    muscle_groups: ["shoulders", "back", "rear_delts"],
    difficulty: "intermediate",
    injuries_to_avoid: ["shoulder"],
  },

  {
    name: "Standing Calf Raises",
    description: "Calf strengthening exercise",
    category: "strength",
    muscle_groups: ["calves"],
    difficulty: "beginner",
    injuries_to_avoid: ["ankle"],
  },

  {
    name: "Jump Rope",
    description: "Cardio exercise improving coordination and endurance",
    category: "cardio",
    muscle_groups: ["calves", "shoulders", "core"],
    difficulty: "intermediate",
    injuries_to_avoid: ["ankle", "wrist"],
  },
]);

const EXERCISES_BY_DIFFICULTY = Object.freeze({
  beginner: EXERCISES.filter((e) => e.difficulty === "beginner"),
  intermediate: EXERCISES.filter((e) => e.difficulty === "intermediate"),
  advanced: EXERCISES.filter((e) => e.difficulty === "advanced"),
});

module.exports = {
  EXERCISES,
  EXERCISES_BY_DIFFICULTY,
};