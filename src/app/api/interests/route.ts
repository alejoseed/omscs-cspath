import { getDb } from "@/lib/db";
import { BUCKETS } from "@/data/specializations";
import type { BucketId } from "@/lib/planner";

export const dynamic = "force-dynamic";

const VALID = new Set<string>(BUCKETS.map((b) => b.id));

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body as { courseId?: unknown; bucket?: unknown };
  const courseId = typeof payload.courseId === "string" ? payload.courseId : "";
  const bucket = payload.bucket;

  if (!courseId) {
    return Response.json({ error: "courseId is required." }, { status: 400 });
  }
  if (bucket !== null && (typeof bucket !== "string" || !VALID.has(bucket))) {
    return Response.json(
      { error: `bucket must be one of ${[...VALID].join(", ")} or null.` },
      { status: 400 },
    );
  }

  const db = getDb();
  const course = db
    .prepare("SELECT id FROM courses WHERE id = ?")
    .get(courseId) as { id: string } | undefined;
  if (!course) {
    return Response.json({ error: `Unknown course ${courseId}.` }, { status: 404 });
  }

  if (bucket === null) {
    db.prepare("DELETE FROM course_interests WHERE course_id = ?").run(courseId);
  } else {
    db.prepare(
      `INSERT INTO course_interests (course_id, bucket_id, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(course_id) DO UPDATE SET
         bucket_id = excluded.bucket_id,
         updated_at = excluded.updated_at`,
    ).run(courseId, bucket as BucketId, new Date().toISOString());
  }

  const rows = db
    .prepare("SELECT course_id AS courseId, bucket_id AS bucket FROM course_interests")
    .all() as { courseId: string; bucket: BucketId }[];

  return Response.json({ interests: Object.fromEntries(rows.map((r) => [r.courseId, r.bucket])) });
}

export async function DELETE() {
  const db = getDb();
  db.prepare("DELETE FROM course_interests").run();
  return Response.json({ interests: {} });
}
