const { formatZodError } = require("../validators");

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          fields: formatZodError(result.error),
        },
      });
    }
    req.validated = result.data;
    next();
  };
}

module.exports = validate;