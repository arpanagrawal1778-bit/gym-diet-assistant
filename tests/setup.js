const path = require("path");
const fs = require("fs");
const os = require("os");

const testDbPath = path.join(os.tmpdir(), `gym-diet-test-${Date.now()}.db`);

process.env.DATABASE_PATH = testDbPath;
process.env.NODE_ENV = "test";
process.env.RATE_LIMIT_MAX_REQUESTS = "100000";

const { connect, close } = require("../src/config/database");
const { readFileSync } = require("fs");
const { join } = require("path");
const { migrate } = require("../src/db/migrate");

function setupTestDb() {
  const db = connect();
  const schemaPath = join(__dirname, "..", "src", "db", "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);
  migrate();
  return db;
}

function teardownTestDb() {
  close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  const walPath = testDbPath + "-wal";
  const shmPath = testDbPath + "-shm";
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
}

module.exports = { setupTestDb, teardownTestDb, testDbPath };
