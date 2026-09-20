const { verifyToken } = require("../utils/auth");
const { getDb } = require("../config/database");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required",
      },
    });
  }

  try {
    const decoded = verifyToken(token);
    const db = getDb();
    const user = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Invalid or expired token",
        },
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Invalid or expired token",
      },
    });
  }
}

module.exports = authMiddleware;