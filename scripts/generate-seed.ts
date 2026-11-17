import fs from "node:fs";
import path from "node:path";

import { COURSES } from "../src/data/courses";
import { SPECIALIZATIONS, BUCKETS } from "../src/data/specializations";
import { STARTER_INTERESTS } from "../src/data/catalog";

function lit(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

const lines: string[] = [];

lines.push("DELETE FROM requirement_courses;");
lines.push("DELETE FROM requirement_groups;");
lines.push("DELETE FROM requirements;");
lines.push("DELETE FROM specializations;");
lines.push("DELETE FROM courses;");
lines.push("DELETE FROM buckets;");
lines.push("");

for (const c of COURSES) {
  lines.push(
    `INSERT INTO courses (id, subject, number, title, credits, foundational, admin, description, tags) VALUES (${[
      lit(c.id),
      lit(c.subject),
      lit(c.number),
      lit(c.title),
      lit(c.credits),
      lit(c.foundational ? 1 : 0),
      lit(c.admin),
      lit(c.description),
      lit(JSON.stringify(c.tags)),
    ].join(", ")});`,
  );
}
lines.push("");

for (const b of BUCKETS) {
  lines.push(
    `INSERT INTO buckets (id, label, weight, position) VALUES (${[
      lit(b.id),
      lit(b.name),
      lit(b.weight),
      lit(BUCKETS.indexOf(b)),
    ].join(", ")});`,
  );
}
lines.push("");

for (const s of SPECIALIZATIONS) {
  lines.push(
    `INSERT INTO specializations (id, name, short_name, credits, blurb, url, flavour) VALUES (${[
      lit(s.id),
      lit(s.name),
      lit(s.shortName),
      lit(s.credits),
      lit(s.blurb),
      lit(s.url),
      lit(JSON.stringify(s.flavourTags)),
    ].join(", ")});`,
  );

  s.requirements.forEach((req, index) => {
    const reqId = `${s.id}:${req.id}`;
    lines.push(
      `INSERT INTO requirements (id, specialization_id, kind, label, n, position) VALUES (${[
        lit(reqId),
        lit(s.id),
        lit(req.type),
        lit(req.label),
        lit(req.type === "nOf" || req.type === "nOfWithEach" ? req.n : null),
        lit(index),
      ].join(", ")});`,
    );
  });

  for (const req of s.requirements) {
    const reqId = `${s.id}:${req.id}`;
    if (req.type === "nOfWithEach") {
      req.groups.forEach((group, gi) => {
        const groupId = `${reqId}:${gi}`;
        lines.push(
          `INSERT INTO requirement_groups (id, requirement_id, label, position) VALUES (${[
            lit(groupId),
            lit(reqId),
            lit(group.label),
            lit(gi),
          ].join(", ")});`,
        );
        group.from.forEach((courseId, ci) => {
          lines.push(
            `INSERT INTO requirement_courses (requirement_id, group_id, course_id, position) VALUES (${[
              lit(reqId),
              lit(groupId),
              lit(courseId),
              lit(ci),
            ].join(", ")});`,
          );
        });
      });
    } else {
      req.from.forEach((courseId, ci) => {
        lines.push(
          `INSERT INTO requirement_courses (requirement_id, group_id, course_id, position) VALUES (${[
            lit(reqId),
            "NULL",
            lit(courseId),
            lit(ci),
          ].join(", ")});`,
        );
      });
    }
  }
  lines.push("");
}

lines.push("DELETE FROM course_interests;");
const now = new Date().toISOString();
for (const [courseId, bucket] of Object.entries(STARTER_INTERESTS)) {
  lines.push(
    `INSERT INTO course_interests (course_id, bucket_id, updated_at) VALUES (${[
      lit(courseId),
      lit(bucket),
      lit(now),
    ].join(", ")});`,
  );
}
lines.push("");

const out = path.join(process.cwd(), "migrations", "0002_seed.sql");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join("\n"));

console.log(
  `Wrote ${out} — ${COURSES.length} courses, ${SPECIALIZATIONS.length} specializations, ${Object.keys(STARTER_INTERESTS).length} starter interests.`,
);
