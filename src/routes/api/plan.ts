import { createFileRoute } from "@tanstack/react-router";
import { getD1 } from "@/lib/d1.server";
import { loadInterests } from "@/lib/planner";
import { generatePlans } from "@/lib/plan.server";
import { clientKey } from "@/lib/rate-limit.server";

export const Route = createFileRoute("/api/plan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body." }, { status: 400 });
        }

        const raw = (body as { interests?: unknown } | null)?.interests;
        const outcome = await generatePlans(raw, clientKey(request));
        if (!outcome.ok) {
          const { status, error, details, retryAfterSeconds } = outcome;
          return Response.json(details ? { error, details } : { error }, {
            status,
            headers: retryAfterSeconds ? { "retry-after": String(retryAfterSeconds) } : undefined,
          });
        }
        return Response.json(outcome.data);
      },

      GET: async () => {
        const interests = await loadInterests(getD1());
        return Response.json({ interests: Object.fromEntries(interests) });
      },
    },
  },
});
