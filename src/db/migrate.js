const { getDb } = require("../config/database");


function isOldHistoryTable(db) {

  try {

    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='calorie_macro_history'"
    ).get();

    if (!row) {
      return false;
    }

    const info =
      db
        .prepare(
          "PRAGMA table_info(calorie_macro_history)"
        )
        .all();

    const columns =
      info.map(
        (c) => c.name
      );

    return !columns.includes(
      "profile_id"
    );

  } catch {

    return false;

  }

}


function migrate() {

  const db = getDb();


  /* =======================================================
     CALORIE / MACRO HISTORY
  ======================================================= */

  if (isOldHistoryTable(db)) {

    db.exec(
      "DROP TABLE IF EXISTS calorie_macro_history"
    );

  }


  db.exec(`
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
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);


  const indexes =
    db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_calorie_macro_history%'"
    ).all();

  const indexNames =
    indexes.map(
      (i) => i.name
    );


  if (
    !indexNames.includes(
      "idx_calorie_macro_history_user_id"
    )
  ) {

    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_calorie_macro_history_user_id ON calorie_macro_history(user_id)"
    );

  }


  if (
    !indexNames.includes(
      "idx_calorie_macro_history_effective_at"
    )
  ) {

    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_calorie_macro_history_effective_at ON calorie_macro_history(effective_at)"
    );

  }


  /* =======================================================
     PROFILE MIGRATIONS
  ======================================================= */

  const profileInfo =
    db
      .prepare(
        "PRAGMA table_info(profiles)"
      )
      .all();

  const profileColumns =
    profileInfo.map(
      (c) => c.name
    );


  const addColumn = (
    column,
    definition
  ) => {

    if (
      !profileColumns.includes(
        column
      )
    ) {

      db.exec(
        `ALTER TABLE profiles ADD COLUMN ${column} ${definition}`
      );

    }

  };


  addColumn(
    "meal_reminders",
    "INTEGER NOT NULL DEFAULT 1"
  );

  addColumn(
    "workout_reminders",
    "INTEGER NOT NULL DEFAULT 1"
  );

  /* NEW: Vegetarian / Non-Vegetarian */
  addColumn(
    "diet_preference",
    "TEXT DEFAULT 'vegetarian'"
  );

  addColumn(
    "weight_checkin_day",
    "TEXT DEFAULT 'Mon'"
  );

  addColumn(
    "progress_photo_frequency",
    "TEXT DEFAULT 'weekly'"
  );

  addColumn(
    "plan_expiry_warning_days",
    "INTEGER NOT NULL DEFAULT 2"
  );

  addColumn(
    "reminder_time",
    "TEXT DEFAULT '08:00'"
  );


  /* =======================================================
     DIET PLAN INDEX
  ======================================================= */

  const planIndexes =
    db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_diet_plans%'"
    ).all();

  const planIndexNames =
    planIndexes.map(
      (i) => i.name
    );


  if (
    !planIndexNames.includes(
      "idx_diet_plans_user_id"
    )
  ) {

    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_diet_plans_user_id ON diet_plans(user_id)"
    );

  }


  /* =======================================================
     GYM PLAN INDEX
  ======================================================= */

  const gymPlanIndexes =
    db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_gym_plans%'"
    ).all();

  const gymPlanIndexNames =
    gymPlanIndexes.map(
      (i) => i.name
    );


  if (
    !gymPlanIndexNames.includes(
      "idx_gym_plans_user_id"
    )
  ) {

    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_gym_plans_user_id ON gym_plans(user_id)"
    );

  }


  /* =======================================================
     SCHEDULE INDEX
  ======================================================= */

  const scheduleIndexes =
    db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_schedules%'"
    ).all();

  const scheduleIndexNames =
    scheduleIndexes.map(
      (i) => i.name
    );


  if (
    !scheduleIndexNames.includes(
      "idx_schedules_user_id"
    )
  ) {

    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id)"
    );

  }

}


module.exports = {
  migrate,
};