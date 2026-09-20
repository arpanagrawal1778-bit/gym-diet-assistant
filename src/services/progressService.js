const { getDb } = require("../config/database");

const LOG_TYPES = Object.freeze([
  "weight",
  "workout_completion",
  "meal_compliance",
  "measurement",
  "progress_photo",
  "custom",
]);

const HISTORY_MAX_LIMIT = 100;
const HISTORY_DEFAULT_DAYS = 56;
const HISTORY_MAX_DAYS = 365;

function validateLogType(logType) {
  return LOG_TYPES.includes(logType);
}

function validateValueJson(valueJson) {
  if (!valueJson || typeof valueJson !== "object" || Array.isArray(valueJson)) {
    return false;
  }
  return Object.keys(valueJson).length > 0;
}

function validateLoggedAt(loggedAt) {
  if (loggedAt === null || loggedAt === undefined) return true;
  if (loggedAt === "") return false;
  const date = new Date(loggedAt);
  if (isNaN(date.getTime())) return false;
  if (date > new Date()) return false;
  return true;
}

function parseLoggedAt(loggedAt) {
  if (!loggedAt) return new Date().toISOString();
  return new Date(loggedAt).toISOString();
}

async function createProgressLog(userId, { log_type, value_json, logged_at }) {
  const db = getDb();
  const parsedLoggedAt = parseLoggedAt(logged_at);

  const result = db.prepare(
    `INSERT INTO progress_logs (user_id, log_type, value_json, logged_at) VALUES (?, ?, ?, ?)`
  ).run(userId, log_type, JSON.stringify(value_json), parsedLoggedAt);

  return {
    id: result.lastInsertRowid,
    user_id: userId,
    log_type,
    value_json,
    logged_at: parsedLoggedAt,
  };
}

async function getProgressLogs(userId, options = {}) {
  const db = getDb();

  const { log_type, start_date, end_date, page = 1, limit = 20 } = options;

  let whereClause = "WHERE user_id = ?";
  const params = [userId];

  if (log_type) {
    whereClause += " AND log_type = ?";
    params.push(log_type);
  }

  if (start_date) {
    whereClause += " AND logged_at >= ?";
    params.push(start_date);
  }

  if (end_date) {
    whereClause += " AND logged_at <= ?";
    params.push(end_date);
  }

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), HISTORY_MAX_LIMIT);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (parsedPage - 1) * parsedLimit;

  const total = db.prepare(`SELECT COUNT(*) as count FROM progress_logs ${whereClause}`).get(...params).count;

  const records = db.prepare(
    `SELECT * FROM progress_logs ${whereClause} ORDER BY logged_at DESC, id DESC LIMIT ? OFFSET ?`
  ).all(...params, parsedLimit, offset);

  const totalPages = Math.ceil(total / parsedLimit);

  return {
    data: records.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      log_type: r.log_type,
      value_json: JSON.parse(r.value_json),
      logged_at: r.logged_at,
    })),
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages,
    },
  };
}

async function getProgressLogById(userId, logId) {
  const db = getDb();
  const record = db.prepare(
    `SELECT * FROM progress_logs WHERE id = ? AND user_id = ?`
  ).get(logId, userId);

  if (!record) return null;

  return {
    id: record.id,
    user_id: record.user_id,
    log_type: record.log_type,
    value_json: JSON.parse(record.value_json),
    logged_at: record.logged_at,
  };
}

async function deleteProgressLog(userId, logId) {
  const db = getDb();
  const result = db.prepare(
    `DELETE FROM progress_logs WHERE id = ? AND user_id = ?`
  ).run(logId, userId);

  return result.changes > 0;
}

function getTodayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

async function completeMeal(userId, mealName) {
  const db = getDb();
  const today = getTodayDate();

  const existingLog = db.prepare(`
    SELECT id
    FROM progress_logs
    WHERE user_id = ?
      AND log_type = 'meal_compliance'
      AND json_extract(value_json, '$.meal_name') = ?
      AND json_extract(value_json, '$.completed_date') = ?
  `).get(userId, mealName, today);

  if (existingLog) {
    return {
      alreadyCompleted: true,
      date: today,
    };
  }

  const loggedAt = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO progress_logs
      (user_id, log_type, value_json, logged_at)
    VALUES (?, ?, ?, ?)
  `).run(
    userId,
    "meal_compliance",
    JSON.stringify({
      meal_name: mealName,
      completed: true,
      completed_date: today,
    }),
    loggedAt
  );

  return {
    alreadyCompleted: false,
    id: result.lastInsertRowid,
    user_id: userId,
    log_type: "meal_compliance",
    value_json: {
      meal_name: mealName,
      completed: true,
      completed_date: today,
    },
    logged_at: loggedAt,
  };
}

async function completeWorkout(userId, workoutName) {
  const db = getDb();
  const today = getTodayDate();

  const existingLog = db.prepare(`
    SELECT id
    FROM progress_logs
    WHERE user_id = ?
      AND log_type = 'workout_completion'
      AND json_extract(value_json, '$.workout_name') = ?
      AND json_extract(value_json, '$.completed_date') = ?
  `).get(userId, workoutName, today);

  if (existingLog) {
    return {
      alreadyCompleted: true,
      date: today,
    };
  }

  const loggedAt = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO progress_logs
      (user_id, log_type, value_json, logged_at)
    VALUES (?, ?, ?, ?)
  `).run(
    userId,
    "workout_completion",
    JSON.stringify({
      workout_name: workoutName,
      completed: true,
      completed_date: today,
    }),
    loggedAt
  );

  return {
    alreadyCompleted: false,
    id: result.lastInsertRowid,
    user_id: userId,
    log_type: "workout_completion",
    value_json: {
      workout_name: workoutName,
      completed: true,
      completed_date: today,
    },
    logged_at: loggedAt,
  };
}

module.exports = {
  createProgressLog,
  getProgressLogs,
  getProgressLogById,
  deleteProgressLog,
  validateLogType,
  validateValueJson,
  validateLoggedAt,
  LOG_TYPES,
  HISTORY_MAX_LIMIT,
  HISTORY_DEFAULT_DAYS,
  HISTORY_MAX_DAYS,
  completeMeal,
  completeWorkout,
};