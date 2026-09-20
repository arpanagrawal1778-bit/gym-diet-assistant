function errorMiddleware(err, req, res, next) {
  console.error("Unhandled error:", err);

  const status = err.status || 500;
  const code = err.code || "SERVER_ERROR";

  res.status(status).json({
    success: false,
    error: {
      code,
      message: status === 500 ? "Internal server error" : err.message,
    },
  });
}

module.exports = errorMiddleware;