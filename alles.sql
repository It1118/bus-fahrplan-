-- ==========================================
-- DATEI: schema.sql
-- ==========================================
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS schedules;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  session_token TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  line TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure TEXT NOT NULL,
  delay INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_email) REFERENCES users(email)
);

CREATE INDEX idx_schedules_user ON schedules(user_email);
