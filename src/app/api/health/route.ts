import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const courses = db.prepare("SELECT COUNT(*) AS n FROM courses").get() as { n: number };
  const specs = db.prepare("SELECT COUNT(*) AS n FROM specializations").get() as { n: number };
  const reqs = db.prepare("SELECT COUNT(*) AS n FROM requirements").get() as { n: number };
  const links = db
    .prepare("SELECT COUNT(*) AS n FROM requirement_courses")
    .get() as { n: number };
  return Response.json({
    ok: true,
    courses: courses.n,
    specializations: specs.n,
    requirements: reqs.n,
    requirementCourseLinks: links.n,
  });
}
