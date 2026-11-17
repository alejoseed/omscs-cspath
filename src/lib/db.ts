import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import { COURSES } from "@/data/courses";
import { BUCKETS, SPECIALIZATIONS } from "@/data/specializations";

export const DB_PATH =
  process.env.OMSCS_DB_PATH ?? path.join(process.cwd(), "data", "omscs.db");

const READ_ONLY_FS = process.env.OMSCS_READ_ONLY_FS === "true";

export type Db = Database.Database;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

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
  id         TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  position   INTEGER NOT NULL
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

-- One row per course the visitor has ranked. This is only the starter palette
-- seeded on first boot; each visitor's own buckets live in their browser.
CREATE TABLE IF NOT EXISTS course_interests (
  course_id  TEXT PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  bucket_id  TEXT NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_requirement_courses_req
  ON requirement_courses(requirement_id);
CREATE INDEX IF NOT EXISTS idx_requirements_spec
  ON requirements(specialization_id);
`;

function seed(db: Db) {
  const insertCourse = db.prepare(
    `INSERT INTO courses
       (id, subject, number, title, credits, foundational, admin, description, tags)
     VALUES (@id, @subject, @number, @title, @credits, @foundational, @admin, @description, @tags)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       tags = excluded.tags,
       foundational = excluded.foundational`,
  );

  const insertSpec = db.prepare(
    `INSERT INTO specializations (id, name, short_name, credits, blurb, url, flavour)
     VALUES (@id, @name, @shortName, @credits, @blurb, @url, @flavour)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       blurb = excluded.blurb,
       credits = excluded.credits,
       flavour = excluded.flavour`,
  );

  const insertReq = db.prepare(
    `INSERT INTO requirements (id, specialization_id, kind, label, n, position)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertGroup = db.prepare(
    `INSERT INTO requirement_groups (id, requirement_id, label, position)
     VALUES (?, ?, ?, ?)`,
  );
  const insertReqCourse = db.prepare(
    `INSERT INTO requirement_courses (requirement_id, group_id, course_id, position)
     VALUES (?, ?, ?, ?)`,
  );

  const insertBucket = db.prepare(
    `INSERT INTO buckets (id, label, weight, position) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET label = excluded.label, weight = excluded.weight`,
  );

  const seedAll = db.transaction(() => {
    for (const c of COURSES) {
      insertCourse.run({
        ...c,
        foundational: c.foundational ? 1 : 0,
        tags: JSON.stringify(c.tags),
      });
    }

    // Requirement rules are catalog data, so rebuild them wholesale on every
    // start. Cascades clear requirement_groups and requirement_courses.
    db.prepare("DELETE FROM requirements").run();

    for (const s of SPECIALIZATIONS) {
      insertSpec.run({
        id: s.id,
        name: s.name,
        shortName: s.shortName,
        credits: s.credits,
        blurb: s.blurb,
        url: s.url,
        flavour: JSON.stringify(s.flavourTags),
      });

      s.requirements.forEach((req, index) => {
        insertReq.run(
          `${s.id}:${req.id}`,
          s.id,
          req.type,
          req.label,
          req.type === "nOf" || req.type === "nOfWithEach" ? req.n : null,
          index,
        );
      });

      for (const req of s.requirements) {
        const reqId = `${s.id}:${req.id}`;
        if (req.type === "nOfWithEach") {
          req.groups.forEach((group, gi) => {
            const groupId = `${reqId}:${gi}`;
            insertGroup.run(groupId, reqId, group.label, gi);
            group.from.forEach((courseId, ci) =>
              insertReqCourse.run(reqId, groupId, courseId, ci),
            );
          });
        } else {
          req.from.forEach((courseId, ci) =>
            insertReqCourse.run(reqId, null, courseId, ci),
          );
        }
      }
    }

    BUCKETS.forEach((b, i) => insertBucket.run(b.id, b.name, b.weight, i));
  });

  seedAll();

  // Interests are user data: only seed them on a fresh database.
  const interestCount = db
    .prepare("SELECT COUNT(*) AS n FROM course_interests")
    .get() as { n: number };
  if (interestCount.n === 0) {
    const insertInterest = db.prepare(
      `INSERT INTO course_interests (course_id, bucket_id, updated_at)
       VALUES (?, ?, ?)`,
    );
    const now = new Date().toISOString();
    for (const [courseId, bucketId] of Object.entries(EXAMPLE_INTERESTS)) {
      insertInterest.run(courseId, bucketId, now);
    }
  }
}

/**
 * A small starter palette so the first visit shows a working plan instead of an
 * empty canvas. Cleared the moment the user edits their buckets.
 */
export const EXAMPLE_INTERESTS: Record<string, string> = {
  "CS-7641": "high",
  "CS-7643": "high",
  "CS-6601": "high",
  "CS-7650": "high",
  "CS-6476": "medium",
  "CS-8803-O27": "medium",
  "CS-6750": "medium",
  "CS-6603": "medium",
  "CS-6515": "low",
  "CS-6250": "low",
  "CS-6310": "low",
};

function migrate(db: Db) {
  const version = db.pragma("user_version", { simple: true }) as number;
  db.exec(SCHEMA);
  if (version < 1) {
    db.pragma("user_version = 1");
  }
}

function create(): Db {
  if (READ_ONLY_FS) {
    const db = new Database(":memory:");
    migrate(db);
    seed(db);
    return db;
  }

  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new Database(DB_PATH);
    migrate(db);
    seed(db);
    return db;
  } catch (error) {
    // Some hosts ship a read-only filesystem. Rather than fail the whole app,
    // fall back to an in-memory database: the catalog still works, but bucket
    // edits only last for the life of the process.
    console.warn(
      `[db] Falling back to in-memory SQLite (${DB_PATH} is not writable):`,
      error instanceof Error ? error.message : error,
    );
    const db = new Database(":memory:");
    migrate(db);
    seed(db);
    return db;
  }
}

const globalForDb = globalThis as unknown as { __omscsDb?: Db };

export function getDb(): Db {
  if (!globalForDb.__omscsDb) {
    globalForDb.__omscsDb = create();
  }
  return globalForDb.__omscsDb;
}
