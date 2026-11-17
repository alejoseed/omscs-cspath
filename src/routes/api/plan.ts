import { createFileRoute } from "@tanstack/react-router";
import { getD1 } from "@/lib/d1.server";
import { loadInterests } from "@/lib/planner";
import { generatePlans } from "@/lib/plan.server";
import { clientKey } from "@/lib/rate-limit.server";

/**
 * Raw HTTP contract for plan runs. The app itself calls the createPlan server
 * function; this stays for scripts and other clients.
 */
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

      /** The starter palette the UI shows on a first visit. */
      GET: async () => {
        const interests = await loadInterests(getD1());
        return Response.json({ interests: Object.fromEntries(interests) });
      },
    },
  },
});
