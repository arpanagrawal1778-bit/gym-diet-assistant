require("dotenv").config();

const env = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  databasePath: process.env.DATABASE_PATH || "./database/gym_assistant.db",
  jwtSecret: process.env.JWT_SECRET || "change_this_in_real_environment",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  llmApiKey: process.env.LLM_API_KEY || "",
  llmModel: process.env.LLM_MODEL || "gemini-3.8-flash",
  planValidityDays: parseInt(process.env.PLAN_VALIDITY_DAYS, 10) || 7,
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: parseInt(process.env.SMTP_PORT, 10) || 0,
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  emailFrom: process.env.EMAIL_FROM || "",
};

function validateEnv() {
  const missing = [];
  if (!process.env.JWT_SECRET) {
    missing.push("JWT_SECRET (using default — change in production)");
  }
  if (missing.length > 0) {
    console.warn("Warning: " + missing.join(", "));
  }
}

validateEnv();

module.exports = env;