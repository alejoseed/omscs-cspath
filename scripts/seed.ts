/**
 * Creates the SQLite database and loads the full OMSCS catalog, all six
 * specialization rule sets, and the three interest buckets. Safe to re-run:
 * catalog rows are refreshed, while your saved interests are preserved.
 *
 * Run with: npm run db:seed
 */
import { getDb, DB_PATH } from "../src/lib/db";

const db = getDb();

const count = (table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

console.log(`Seeded ${DB_PATH}`);
console.log(`  courses               ${count("courses")}`);
console.log(`  specializations       ${count("specializations")}`);
console.log(`  requirements          ${count("requirements")}`);
console.log(`  requirement groups    ${count("requirement_groups")}`);
console.log(`  requirement courses   ${count("requirement_courses")}`);
console.log(`  buckets               ${count("buckets")}`);
console.log(`  saved interests       ${count("course_interests")}`);

const rows = db
  .prepare(
    `SELECT s.short_name AS name, s.credits,
            (SELECT COUNT(*) FROM requirements r WHERE r.specialization_id = s.id) AS reqs
     FROM specializations s ORDER BY s.name`,
  )
  .all() as { name: string; credits: number; reqs: number }[];

for (const row of rows) {
  console.log(`  ${row.name.padEnd(10)} ${row.credits} cr, ${row.reqs} requirement group(s)`);
}

db.close();
