const { getDb } = require("../config/database");
const { hashPassword, verifyPassword, generateToken, safeUser } = require("../utils/auth");

async function signup(req, res, next) {
  try {
    const { name, email, password } = req.validated;
    const db = getDb();

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: "EMAIL_EXISTS",
          message: "An account with this email already exists",
        },
      });
    }

    const passwordHash = await hashPassword(password);
    const userRow = db.prepare(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
    ).run(name, email, passwordHash);

    const user = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(userRow.lastInsertRowid);

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: {
        user: safeUser(user),
        token,
      },
      message: "Account created successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.validated;
    const db = getDb();

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      data: {
        user: safeUser(user),
        token,
      },
      message: "Logged in successfully",
    });
  } catch (err) {
    next(err);
  }
}

function me(req, res) {
  res.json({
    success: true,
    data: req.user,
  });
}

function logout(req, res) {
  res.json({
    success: true,
    message: "Logged out successfully",
  });
}

module.exports = {
  signup,
  login,
  me,
  logout,
};