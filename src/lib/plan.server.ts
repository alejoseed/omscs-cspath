import { getD1 } from "@/lib/d1.server";
import {
  loadCatalog,
  buildAllPlans,
  validatePlan,
  sanitizeInterests,
  type BucketId,
} from "@/lib/planner";
import { rankPlans, deepseekConfigured } from "@/lib/llm.server";
import { checkRateLimit, pruneRateWindows } from "@/lib/rate-limit.server";
import type { PlanResponse } from "@/lib/types";

export type PlanFailure = {
  ok: false;
  status: number;
  error: string;
  details?: { specId: string; errors: string[] }[];
  retryAfterSeconds?: number;
};

export type PlanOutcome = { ok: true; data: PlanResponse } | PlanFailure;

/**
 * Solves, validates and ranks a plan for every specialization. Shared by the
 * createPlan server function the UI calls and the raw /api/plan endpoint, so
 * both enforce the same rate limit and input rules.
 */
export async function generatePlans(rawInterests: unknown, clientKey: string): Promise<PlanOutcome> {
  const db = getD1();
  await pruneRateWindows(db);
  const limit = await checkRateLimit(db, clientKey);
  if (!limit.allowed) {
    return {
      ok: false,
      status: 429,
      error: `Too many plan runs. Try again in ${limit.retryAfterSeconds}s — each run calls DeepSeek.`,
      retryAfterSeconds: limit.retryAfterSeconds,
    };
  }

  const catalog = await loadCatalog(db);

  // Interests belong to the browser, so they arrive with the request. Anything
  // that does not match a real course id and bucket is dropped rather than
  // trusted, and the size of the payload is bounded by the catalog itself.
  const interests = sanitizeInterests(rawInterests, catalog);
  if (!interests) {
    return {
      ok: false,
      status: 400,
      error: "Body must be { interests: { [courseId]: 'high' | 'medium' | 'low' } }.",
    };
  }

  if (interests.size < 4) {
    return {
      ok: false,
      status: 400,
      error:
        "Put at least four courses in your buckets first — a ten-course plan needs something to work with.",
    };
  }

  const set = buildAllPlans(catalog, interests);

  if (set.plans.length === 0) {
    return { ok: false, status: 500, error: "No specialization could be satisfied from this catalog." };
  }

  const checked = set.plans.map((plan) => {
    const spec = catalog.specs.find((s) => s.id === plan.specId)!;
    return { plan, validation: validatePlan(plan, spec, catalog) };
  });

  const invalid = checked.filter((c) => !c.validation.ok);
  if (invalid.length) {
    return {
      ok: false,
      status: 500,
      error: "Solver produced an invalid plan.",
      details: invalid.map((i) => ({ specId: i.plan.specId, errors: i.validation.errors })),
    };
  }

  const narrative = await rankPlans(
    set.plans,
    Object.fromEntries(interests) as Record<string, string>,
  );

  // Merge the model's ordering onto the solver's plans.
  const bySpec = new Map(set.plans.map((p) => [p.specId, p]));
  const ordered = narrative.ranked
    .map((r) => bySpec.get(r.specId))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const remaining = set.plans.filter((p) => !ordered.includes(p));
  const finalPlans = [...ordered, ...remaining];

  const narrativeFor = new Map(narrative.ranked.map((r) => [r.specId, r]));

  return {
    ok: true,
    data: {
      engine: narrative.engine,
      model: narrative.model,
      deepseekConfigured: deepseekConfigured(),
      summary: narrative.summary,
      warning: narrative.error ?? null,
      plans: finalPlans.map((plan, i) => ({
        ...plan,
        rank: i + 1,
        headline: narrativeFor.get(plan.specId)?.headline ?? "",
        rationale: narrativeFor.get(plan.specId)?.rationale ?? "",
        watchOuts: narrativeFor.get(plan.specId)?.watchOuts ?? [],
        coverage: plan.courses.filter((c: { bucket: BucketId | null }) => c.bucket !== null)
          .length,
      })),
      coverage: set.coverage,
      uncovered: set.uncovered,
      interestCount: set.interestCount,
      totalCourseCount: set.totalCourseCount,
      createdAt: new Date().toISOString(),
    },
  };
}
