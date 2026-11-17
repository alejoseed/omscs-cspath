import { createFileRoute } from "@tanstack/react-router";
import { getD1 } from "@/lib/d1.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const db = getD1();

        const [courses, specs, reqs, links] = await Promise.all([
          db.prepare("SELECT COUNT(*) AS n FROM courses").first<{ n: number }>(),
          db.prepare("SELECT COUNT(*) AS n FROM specializations").first<{ n: number }>(),
          db.prepare("SELECT COUNT(*) AS n FROM requirements").first<{ n: number }>(),
          db.prepare("SELECT COUNT(*) AS n FROM requirement_courses").first<{ n: number }>(),
        ]);

        return Response.json({
          ok: true,
          courses: courses?.n ?? 0,
          specializations: specs?.n ?? 0,
          requirements: reqs?.n ?? 0,
          requirementCourseLinks: links?.n ?? 0,
        });
      },
    },
  },
});
