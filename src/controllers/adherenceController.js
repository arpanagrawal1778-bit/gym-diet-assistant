const { getWeeklyAdherence, getAdherenceSummary, ValidationError } = require("../services/adherenceService");

async function getWeekly(req, res, next) {
  try {
    const userId = req.user.id;
    const { week_start } = req.query;

    const result = await getWeeklyAdherence(userId, { week_start });

    return res.json({
      success: true,
      data: result.data,
      message: result.message,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(err.status).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          fields: err.fields,
        },
      });
    }
    next(err);
  }
}

async function getSummary(req, res, next) {
  try {
    const userId = req.user.id;
    const { weeks } = req.query;

    const result = await getAdherenceSummary(userId, { weeks });

    return res.json({
      success: true,
      data: result.data,
      message: result.message,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(err.status).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          fields: err.fields,
        },
      });
    }
    next(err);
  }
}

module.exports = {
  getWeekly,
  getSummary,
};
