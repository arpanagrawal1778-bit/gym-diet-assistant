const { getDb } = require("../config/database");
const {
  createProgressLog,
  getProgressLogs,
  getProgressLogById,
  deleteProgressLog,
  validateLogType,
  validateValueJson,
  validateLoggedAt,
  completeMeal,
  completeWorkout,
} = require("../services/progressService");

async function createProgress(req, res, next) {
  try {
    const userId = req.user.id;
    const { log_type, value_json, logged_at } = req.validated;

    if (!validateLogType(log_type)) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid log type", fields: { log_type: "Invalid log type" } },
      });
    }

    if (!validateValueJson(value_json)) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "value_json must be a non-empty object", fields: { value_json: "value_json must be a non-empty object" } },
      });
    }

    if (!validateLoggedAt(logged_at)) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid logged_at date", fields: { logged_at: "logged_at must be a valid past or present ISO datetime" } },
      });
    }

    const log = await createProgressLog(userId, { log_type, value_json, logged_at });

    return res.status(201).json({
      success: true,
      data: log,
      message: "Progress log created successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function getProgress(req, res, next) {
  try {
    const userId = req.user.id;
    const { log_type, start_date, end_date, page, limit } = req.query;

    const result = await getProgressLogs(userId, { log_type, start_date, end_date, page, limit });

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      message: "Progress logs retrieved successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function getProgressById(req, res, next) {
  try {
    const userId = req.user.id;
    const logId = parseInt(req.params.id, 10);

    if (isNaN(logId)) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid log ID", fields: { id: "ID must be a valid integer" } },
      });
    }

    const log = await getProgressLogById(userId, logId);

    if (!log) {
      return res.status(404).json({
        success: false,
        error: { code: "PROGRESS_LOG_NOT_FOUND", message: "Progress log not found" },
      });
    }

    return res.json({
      success: true,
      data: log,
      message: "Progress log retrieved successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function deleteProgress(req, res, next) {
  try {
    const userId = req.user.id;
    const logId = parseInt(req.params.id, 10);

    if (isNaN(logId)) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid log ID", fields: { id: "ID must be a valid integer" } },
      });
    }

    const deleted = await deleteProgressLog(userId, logId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { code: "PROGRESS_LOG_NOT_FOUND", message: "Progress log not found" },
      });
    }

    return res.json({
      success: true,
      message: "Progress log deleted successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function completeMealProgress(req, res, next) {
  try {
    const userId = req.user.id;
    const { meal_name } = req.body;

    if (!meal_name || typeof meal_name !== "string" || !meal_name.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "meal_name is required",
          fields: {
            meal_name: "meal_name is required",
          },
        },
      });
    }

    const result = await completeMeal(userId, meal_name.trim());

    return res.status(result.alreadyCompleted ? 200 : 201).json({
      success: true,
      data: result,
      message: result.alreadyCompleted
        ? "Meal already completed today"
        : "Meal marked as completed",
    });
  } catch (err) {
    next(err);
  }
}

async function completeWorkoutProgress(req, res, next) {
  try {
    const userId = req.user.id;
    const { workout_name } = req.body;

    if (
      !workout_name ||
      typeof workout_name !== "string" ||
      !workout_name.trim()
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "workout_name is required",
          fields: {
            workout_name: "workout_name is required",
          },
        },
      });
    }

    const result = await completeWorkout(
      userId,
      workout_name.trim()
    );

    return res.status(result.alreadyCompleted ? 200 : 201).json({
      success: true,
      data: result,
      message: result.alreadyCompleted
        ? "Workout already completed today"
        : "Workout marked as completed",
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createProgress,
  getProgress,
  getProgressById,
  deleteProgress,
  completeMealProgress,
  completeWorkoutProgress,
};