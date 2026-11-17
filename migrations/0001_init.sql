-- OMSCS Path Builder schema for Cloudflare D1.
-- The catalog and specialization rules are seeded from src/data via
-- `npm run db:seed`, so this file only defines structure.

CREATE TABLE IF NOT EXISTS courses (
  id            TEXT PRIMARY KEY,
  subject       TEXT NOT NULL,
  number        TEXT NOT NULL,
  title         TEXT NOT NULL,
  credits       INTEGER NOT NULL DEFAULT 3,
  foundational  INTEGER NOT NULL DEFAULT 0,
  admin         TEXT NOT NULL,
  description   TEXT NOT NULL,
  tags          TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS specializations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  short_name  TEXT NOT NULL,
  credits     INTEGER NOT NULL,
  blurb       TEXT NOT NULL,
  url         TEXT NOT NULL,
  flavour     TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS requirements (
  id                TEXT PRIMARY KEY,
  specialization_id TEXT NOT NULL REFERENCES specializations(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL,
  label             TEXT NOT NULL,
  n                 INTEGER,
  position          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS requirement_groups (
  id             TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  label          TEXT NOT NULL,
  position       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS requirement_courses (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  group_id       TEXT REFERENCES requirement_groups(id) ON DELETE CASCADE,
  course_id      TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS buckets (
  id       TEXT PRIMARY KEY,
  label    TEXT NOT NULL,
  weight   REAL NOT NULL,
  position INTEGER NOT NULL
);

-- The starter palette shown on a first visit. Each visitor's own buckets live
-- in their browser, so this table is reference data, not personal state.
CREATE TABLE IF NOT EXISTS course_interests (
  course_id  TEXT PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  bucket_id  TEXT NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_requirement_courses_req
  ON requirement_courses(requirement_id);
CREATE INDEX IF NOT EXISTS idx_requirements_spec
  ON requirements(specialization_id);

-- Fixed-window counters for /api/plan. D1 is the only durable place to keep
-- these, since a Workers isolate does not outlive a request.
CREATE TABLE IF NOT EXISTS rate_limits (
  id           TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window
  ON rate_limits(window_start);
