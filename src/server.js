require("./config/env");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { connect } = require("./config/database");

const { readFileSync } = require("fs");
const { join } = require("path");

const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const calculationRoutes = require("./routes/calculationRoutes");
const planRoutes = require("./routes/planRoutes");
const dietPlanRoutes = require("./routes/dietPlanRoutes");
const gymPlanRoutes = require("./routes/gymPlanRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");
const progressRoutes = require("./routes/progressRoutes");
const weightRoutes = require("./routes/weightRoutes");
const adherenceRoutes = require("./routes/adherenceRoutes");
const reminderRoutes = require("./routes/reminderRoutes");

const reminderScheduler = require("./services/reminderScheduler");

const { migrate } = require("./db/migrate");

const errorMiddleware = require("./middleware/errorMiddleware");

const env = require("./config/env");

const app = express();


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(helmet());

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  })
);

app.use(express.static("public"));

app.use(express.json());


/* =========================================================
   RATE LIMITING
========================================================= */

const limiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMaxRequests,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message:
        "Too many requests, please try again later",
    },
  },
});

app.use(limiter);


/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

function initializeDatabase() {
  const db = connect();

  migrate();

  const schemaPath = join(
    __dirname,
    "db",
    "schema.sql"
  );

  const schema =
    readFileSync(
      schemaPath,
      "utf-8"
    );

  db.exec(schema);

  console.log(
    "Database initialized"
  );
}


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      success: true,
      message:
        "Gym & Diet Assistant API is running",
    });
  }
);


/* =========================================================
   ROUTES
========================================================= */

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/profile",
  profileRoutes
);

app.use(
  "/api/calculations",
  calculationRoutes
);

app.use(
  "/api",
  planRoutes
);

app.use(
  "/api/plans",
  dietPlanRoutes
);

app.use(
  "/api/plans",
  gymPlanRoutes
);

/*
 * IMPORTANT:
 * scheduleRoutes.js already contains:
 *
 * GET  /schedule
 * POST /schedule/regenerate
 * GET  /schedule/history
 *
 * Therefore it must be mounted at /api,
 * not /api/plans.
 */
app.use(
  "/api",
  scheduleRoutes
);

app.use(
  "/api/progress",
  progressRoutes
);

app.use(
  "/api/weight",
  weightRoutes
);

app.use(
  "/api/adherence",
  adherenceRoutes
);

app.use(
  "/api/reminders",
  reminderRoutes
);


/* =========================================================
   404 HANDLER
========================================================= */

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
    });
  }
);


/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  errorMiddleware
);


/* =========================================================
   START SERVER
========================================================= */

function start() {
  try {
    initializeDatabase();

    // Start reminder scheduler after DB is ready
    reminderScheduler.start();

    app.listen(
      env.port,
      () => {
        console.log(
          `Server running on port ${env.port} (${env.nodeEnv})`
        );
      }
    );
  } catch (err) {
    console.error(
      "Failed to start server:",
      err
    );

    process.exit(1);
  }
}


/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

function shutdown() {
  try {
    reminderScheduler.stop();

    // better-sqlite3 does not require explicit
    // shutdown handling here.

    process.exit(0);
  } catch (error) {
    console.error(
      "Error during shutdown:",
      error
    );

    process.exit(1);
  }
}

process.on(
  "SIGINT",
  shutdown
);

process.on(
  "SIGTERM",
  shutdown
);


/* =========================================================
   RUN
========================================================= */

if (require.main === module) {
  start();
}


module.exports = {
  app,
  start,
};