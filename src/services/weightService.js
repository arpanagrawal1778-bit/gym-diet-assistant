const { getDb } = require("../config/database");
const { calculateAll } = require("./calculationService");

const HISTORY_MAX_LIMIT = 100;
const HISTORY_DEFAULT_DAYS = 56;
const HISTORY_MAX_DAYS = 365;

function validateWeight(weight) {
  return Number.isFinite(weight) && weight >= 30 && weight <= 300;
}

function validateRecordedAt(recordedAt) {
  if (!recordedAt) return true;
  const date = new Date(recordedAt);
  if (isNaN(date.getTime())) return false;
  if (date > new Date()) return false;
  return true;
}

function parseRecordedAt(recordedAt) {
  if (!recordedAt) return new Date().toISOString();
  return new Date(recordedAt).toISOString();
}

async function createWeightEntry(userId, { weight, recorded_at }) {
  const db = getDb();
  const parsedRecordedAt = parseRecordedAt(recorded_at);

  const result = db.prepare(
    `INSERT INTO weight_history (user_id, weight, recorded_at) VALUES (?, ?, ?)`
  ).run(userId, weight, parsedRecordedAt);

  const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId);
  if (profile) {
    db.prepare("UPDATE profiles SET needs_calorie_recalculation = 1 WHERE user_id = ?").run(userId);
  }

  return {
    id: result.lastInsertRowid,
    user_id: userId,
    weight,
    recorded_at: parsedRecordedAt,
  };
}

async function getWeightHistory(userId, options = {}) {
  const db = getDb();

  const { start_date, end_date, page = 1, limit = 20 } = options;

  let whereClause = "WHERE user_id = ?";
  const params = [userId];

  if (start_date) {
    whereClause += " AND recorded_at >= ?";
    params.push(start_date);
  }

  if (end_date) {
    whereClause += " AND recorded_at <= ?";
    params.push(end_date);
  }

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), HISTORY_MAX_LIMIT);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (parsedPage - 1) * parsedLimit;

  const total = db.prepare(`SELECT COUNT(*) as count FROM weight_history ${whereClause}`).get(...params).count;

  const records = db.prepare(
    `SELECT * FROM weight_history ${whereClause} ORDER BY recorded_at DESC, id DESC LIMIT ? OFFSET ?`
  ).all(...params, parsedLimit, offset);

  const totalPages = Math.ceil(total / parsedLimit);

  return {
    data: records.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      weight: r.weight,
      recorded_at: r.recorded_at,
    })),
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages,
    },
  };
}

async function getLatestWeight(userId) {
  const db = getDb();
  const record = db.prepare(
    `SELECT * FROM weight_history WHERE user_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1`
  ).get(userId);

  if (!record) return null;

  return {
    id: record.id,
    user_id: record.user_id,
    weight: record.weight,
    recorded_at: record.recorded_at,
  };
}

async function getWeightTrend(userId, days = 30) {
  const db = getDb();
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const records = db.prepare(
    `SELECT weight, recorded_at FROM weight_history 
     WHERE user_id = ? AND recorded_at >= ?
     ORDER BY recorded_at ASC, id ASC`
  ).all(userId, cutoffDate);

  if (records.length === 0) {
    return {
      period_days: days,
      entries: 0,
      first_weight: null,
      last_weight: null,
      weight_change: null,
      average_weight: null,
      min_weight: null,
      max_weight: null,
    };
  }

  const weights = records.map((r) => r.weight);
  const firstWeight = weights[0];
  const lastWeight = weights[weights.length - 1];
  const weightChange = lastWeight - firstWeight;
  const averageWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);

  return {
    period_days: days,
    entries: records.length,
    first_weight: firstWeight,
    last_weight: lastWeight,
    weight_change: Math.round(weightChange * 100) / 100,
    average_weight: Math.round(averageWeight * 100) / 100,
    min_weight: minWeight,
    max_weight: maxWeight,
  };
}

async function deleteWeightEntry(userId, weightId) {
  const db = getDb();
  const result = db.prepare(
    `DELETE FROM weight_history WHERE id = ? AND user_id = ?`
  ).run(weightId, userId);

  return result.changes > 0;
}

module.exports = {
  createWeightEntry,
  getWeightHistory,
  getLatestWeight,
  getWeightTrend,
  deleteWeightEntry,
  validateWeight,
  validateRecordedAt,
  parseRecordedAt,
  HISTORY_MAX_LIMIT,
  HISTORY_DEFAULT_DAYS,
  HISTORY_MAX_DAYS,
};