import { getD1 } from "@/lib/d1";
import {
  loadCatalog,
  loadInterests,
  buildAllPlans,
  validatePlan,
  sanitizeInterests,
  type BucketId,
} from "@/lib/planner";
import { rankPlans, deepseekConfigured } from "@/lib/llm";
import { checkRateLimit, clientKey, pruneRateWindows } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const db = getD1();
  await pruneRateWindows(db);
  const limit = await checkRateLimit(db, clientKey(request));
  if (!limit.allowed) {
    return Response.json(
      {
        error: `Too many plan runs. Try again in ${limit.retryAfterSeconds}s — each run calls DeepSeek.`,
      },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const catalog = await loadCatalog(db);

  // Interests belong to the browser, so they arrive with the request. Anything
  // that does not match a real course id and bucket is dropped rather than
  // trusted, and the size of the payload is bounded by the catalog itself.
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = (body as { interests?: unknown } | null)?.interests;
  const interests = sanitizeInterests(raw, catalog);
  if (!interests) {
    return Response.json(
      { error: "Body must be { interests: { [courseId]: 'high' | 'medium' | 'low' } }." },
      { status: 400 },
    );
  }

  if (interests.size < 4) {
    return Response.json(
      {
        error: "Put at least four courses in your buckets first — a ten-course plan needs something to work with.",
      },
      { status: 400 },
    );
  }

  const set = buildAllPlans(catalog, interests);

  if (set.plans.length === 0) {
    return Response.json(
      { error: "No specialization could be satisfied from this catalog." },
      { status: 500 },
    );
  }

  const checked = set.plans.map((plan) => {
    const spec = catalog.specs.find((s) => s.id === plan.specId)!;
    return { plan, validation: validatePlan(plan, spec, catalog) };
  });

  const invalid = checked.filter((c) => !c.validation.ok);
  if (invalid.length) {
    return Response.json(
      {
        error: "Solver produced an invalid plan.",
        details: invalid.map((i) => ({ specId: i.plan.specId, errors: i.validation.errors })),
      },
      { status: 500 },
    );
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

  return Response.json({
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
  });
}

/** The starter palette the UI shows on a first visit. */
export async function GET() {
  const interests = await loadInterests(getD1());
  return Response.json({ interests: Object.fromEntries(interests) });
}
