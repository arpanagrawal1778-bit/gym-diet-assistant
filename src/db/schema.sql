-- Gym & Diet Assistant - Phase 1 Schema
-- Designed to support future phases without requiring a complete rewrite.

PRAGMA foreign_keys = ON;


-- =========================================================
-- USERS
-- =========================================================

CREATE TABLE IF NOT EXISTS users (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    email TEXT NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    updated_at TEXT NOT NULL DEFAULT (datetime('now'))

);


-- =========================================================
-- PROFILES
-- =========================================================

CREATE TABLE IF NOT EXISTS profiles (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL UNIQUE,

    gender TEXT NOT NULL,

    age INTEGER NOT NULL,

    height REAL NOT NULL,

    weight REAL NOT NULL,

    activity_level TEXT NOT NULL,

    fitness_goal TEXT NOT NULL,

    -- NEW: vegetarian / non_vegetarian
    diet_preference TEXT NOT NULL DEFAULT 'vegetarian',

    target_body_description TEXT,

    monthly_diet_budget REAL NOT NULL,

    college_start_time TEXT,

    college_end_time TEXT,

    college_days TEXT DEFAULT '[]',

    allergies TEXT DEFAULT '[]',

    injuries TEXT DEFAULT '[]',

    gym_experience_level TEXT NOT NULL,

    gym_experience_note TEXT,

    meal_reminders INTEGER DEFAULT 1,

    workout_reminders INTEGER DEFAULT 1,

    needs_calorie_recalculation INTEGER NOT NULL DEFAULT 0,

    needs_diet_regeneration INTEGER NOT NULL DEFAULT 0,

    needs_gym_regeneration INTEGER NOT NULL DEFAULT 0,

    needs_schedule_regeneration INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE

);


-- =========================================================
-- DIET PLANS
-- =========================================================

CREATE TABLE IF NOT EXISTS diet_plans (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    meals_json TEXT,

    generated_at TEXT NOT NULL DEFAULT (datetime('now')),

    valid_until TEXT,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE

);


-- =========================================================
-- GYM PLANS
-- =========================================================

CREATE TABLE IF NOT EXISTS gym_plans (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    workouts_json TEXT,

    generated_at TEXT NOT NULL DEFAULT (datetime('now')),

    valid_until TEXT,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE

);


-- =========================================================
-- SCHEDULES
-- =========================================================

CREATE TABLE IF NOT EXISTS schedules (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    merged_schedule_json TEXT,

    generated_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE

);


-- =========================================================
-- PROGRESS LOGS
-- =========================================================

CREATE TABLE IF NOT EXISTS progress_logs (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    log_type TEXT,

    value_json TEXT,

    logged_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE

);


-- =========================================================
-- WEIGHT HISTORY
-- =========================================================

CREATE TABLE IF NOT EXISTS weight_history (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    weight REAL NOT NULL,

    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE

);


-- =========================================================
-- REMINDER LOGS
-- =========================================================

CREATE TABLE IF NOT EXISTS reminder_logs (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    reminder_type TEXT,

    sent_at TEXT NOT NULL DEFAULT (datetime('now')),

    status TEXT,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE

);


-- =========================================================
-- CALORIE / MACRO HISTORY
-- =========================================================

CREATE TABLE IF NOT EXISTS calorie_macro_history (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    profile_id INTEGER NOT NULL,

    bmr REAL,

    tdee REAL,

    calorie_target REAL,

    protein_grams REAL,

    carbs_grams REAL,

    fat_grams REAL,

    fitness_goal TEXT,

    activity_level TEXT,

    weight REAL,

    trigger TEXT,

    effective_at TEXT NOT NULL DEFAULT (datetime('now')),

    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (profile_id)
        REFERENCES profiles(id)
        ON DELETE CASCADE

);


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS
    idx_profiles_user_id
    ON profiles(user_id);

CREATE INDEX IF NOT EXISTS
    idx_calorie_macro_history_user_id
    ON calorie_macro_history(user_id);

CREATE INDEX IF NOT EXISTS
    idx_calorie_macro_history_profile_id
    ON calorie_macro_history(profile_id);

CREATE INDEX IF NOT EXISTS
    idx_calorie_macro_history_effective_at
    ON calorie_macro_history(effective_at);

CREATE INDEX IF NOT EXISTS
    idx_diet_plans_user_id
    ON diet_plans(user_id);

CREATE INDEX IF NOT EXISTS
    idx_gym_plans_user_id
    ON gym_plans(user_id);

CREATE INDEX IF NOT EXISTS
    idx_schedules_user_id
    ON schedules(user_id);

CREATE INDEX IF NOT EXISTS
    idx_progress_logs_user_id
    ON progress_logs(user_id);

CREATE INDEX IF NOT EXISTS
    idx_weight_history_user_id
    ON weight_history(user_id);

CREATE INDEX IF NOT EXISTS
    idx_reminder_logs_user_id
    ON reminder_logs(user_id);