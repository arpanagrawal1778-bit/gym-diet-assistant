const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const env = require("./env");

let db = null;

function getDatabasePath() {
  const dbPath = env.databasePath;
  const dir = path.dirname(path.resolve(dbPath));

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return path.resolve(dbPath);
}

function connect() {
  if (db) {
    return db;
  }

  const dbPath = getDatabasePath();
  db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return db;
}

function getDb() {
  if (!db) {
    return connect();
  }
  return db;
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  connect,
  getDb,
  close,
};