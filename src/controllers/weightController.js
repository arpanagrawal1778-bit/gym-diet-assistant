const { getDb } = require("../config/database");
const {
  createWeightEntry,
  getWeightHistory,
  getLatestWeight: getLatestWeightService,
  getWeightTrend: getWeightTrendService,
  deleteWeightEntry,
  validateWeight,
  validateRecordedAt,
} = require("../services/weightService");

async function createWeight(req, res, next) {
  try {
    const userId = req.user.id;
    const { weight, recorded_at } = req.validated;

    if (!validateWeight(weight)) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid weight", fields: { weight: "Weight must be between 30 and 300 kg" } },
      });
    }

    if (!validateRecordedAt(recorded_at)) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid recorded_at date", fields: { recorded_at: "recorded_at must be a valid past or present ISO datetime" } },
      });
    }

    const entry = await createWeightEntry(userId, { weight, recorded_at });

    return res.status(201).json({
      success: true,
      data: entry,
      message: "Weight entry recorded successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function getWeight(req, res, next) {
  try {
    const userId = req.user.id;
    const { start_date, end_date, page, limit } = req.query;

    const result = await getWeightHistory(userId, { start_date, end_date, page, limit });

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      message: "Weight history retrieved successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function getLatestWeight(req, res, next) {
  try {
    const userId = req.user.id;

    const entry = await getLatestWeightService(userId);

    if (!entry) {
      return res.status(404).json({
        success: false,
        error: { code: "WEIGHT_NOT_FOUND", message: "No weight entries found" },
      });
    }

    return res.json({
      success: true,
      data: entry,
      message: "Latest weight retrieved successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function getWeightTrend(req, res, next) {
  try {
    const userId = req.user.id;
    let days = parseInt(req.query.days, 10);

    if (isNaN(days) || days <= 0) {
      days = 30;
    }
    if (days > 365) {
      days = 365;
    }

    const trend = await getWeightTrendService(userId, days);

    return res.json({
      success: true,
      data: trend,
      message: "Weight trend retrieved successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function deleteWeight(req, res, next) {
  try {
    const userId = req.user.id;
    const weightId = parseInt(req.params.id, 10);

    if (isNaN(weightId)) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid weight ID", fields: { id: "ID must be a valid integer" } },
      });
    }

    const deleted = await deleteWeightEntry(userId, weightId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { code: "WEIGHT_NOT_FOUND", message: "Weight entry not found" },
      });
    }

    return res.json({
      success: true,
      message: "Weight entry deleted successfully",
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createWeight,
  getWeight,
  getLatestWeight,
  getWeightTrend,
  deleteWeight,
};