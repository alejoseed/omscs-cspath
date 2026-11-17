import { getDb } from "@/lib/db";
import { loadCatalog, loadInterests, buildAllPlans, validatePlan } from "@/lib/planner";
import { rankPlans, deepseekConfigured } from "@/lib/llm";
import { checkRateLimit, clientKey, pruneRateWindows } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  pruneRateWindows();
  const limit = checkRateLimit(clientKey(request));
  if (!limit.allowed) {
    return Response.json(
      {
        error: `Too many plan runs. Try again in ${limit.retryAfterSeconds}s — each run calls DeepSeek.`,
      },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const db = getDb();
  const catalog = loadCatalog(db);
  const interests = loadInterests(db);

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

  const payload = {
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
      coverage: plan.courses.filter((c) => c.bucket !== null).length,
    })),
    coverage: set.coverage,
    uncovered: set.uncovered,
    interestCount: set.interestCount,
    totalCourseCount: set.totalCourseCount,
    createdAt: new Date().toISOString(),
  };

  const id = `run_${Date.now().toString(36)}`;
  db.prepare(
    `INSERT INTO plan_runs (id, created_at, interests, plans, narrative, engine)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    payload.createdAt,
    JSON.stringify(Object.fromEntries(interests)),
    JSON.stringify(payload.plans),
    narrative.summary,
    narrative.engine,
  );

  // Keep only the most recent runs so the file does not grow without bound.
  db.prepare(
    `DELETE FROM plan_runs WHERE id NOT IN (
       SELECT id FROM plan_runs ORDER BY created_at DESC LIMIT 50
     )`,
  ).run();

  return Response.json({ id, ...payload });
}
