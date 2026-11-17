/**
 * Verifies the planner against the real catalog: for a range of interest mixes,
 * every specialization must produce exactly 10 distinct courses / 30 credits and
 * satisfy its official requirement set.
 *
 * Run with: npx tsx scripts/verify-plans.ts
 */
import { getDb } from "../src/lib/db";
import {
  loadCatalog,
  loadInterests,
  buildAllPlans,
  validatePlan,
  type Catalog,
  type BucketId,
} from "../src/lib/planner";

const db = getDb();
const catalog: Catalog = loadCatalog(db);

console.log(
  `Catalog: ${catalog.courses.length} courses, ${catalog.specs.length} specializations`,
);
for (const spec of catalog.specs) {
  const reqs = spec.requirements.map((r) => `${r.type}:${r.from.length}`).join(", ");
  console.log(`  ${spec.shortName.padEnd(9)} ${spec.credits}cr  ${reqs}`);
}

function check(label: string, interests: Map<string, BucketId>) {
  const set = buildAllPlans(catalog, interests);
  if (set.plans.length !== catalog.specs.length) {
    throw new Error(
      `${label}: only ${set.plans.length}/${catalog.specs.length} plans built`,
    );
  }

  for (const plan of set.plans) {
    const spec = catalog.specs.find((s) => s.id === plan.specId)!;
    const validation = validatePlan(plan, spec, catalog);
    if (!validation.ok) {
      throw new Error(`${label} / ${plan.specId}: ${validation.errors.join("; ")}`);
    }
    const ids = plan.courses.map((c) => c.id);
    if (ids.length !== 10) throw new Error(`${label} / ${plan.specId}: ${ids.length} courses`);
    if (new Set(ids).size !== 10) throw new Error(`${label} / ${plan.specId}: duplicates`);
    if (plan.totalCredits !== 30) {
      throw new Error(`${label} / ${plan.specId}: ${plan.totalCredits} credits`);
    }
    const nonCS = ids.filter((id) => {
      const c = catalog.byId.get(id)!;
      return c.subject !== "CS" && c.subject !== "CSE";
    });
    if (nonCS.length * 3 > 6) {
      throw new Error(
        `${label} / ${plan.specId}: ${nonCS.length} non-CS/CSE courses exceeds the 6-credit cap (${nonCS.join(", ")})`,
      );
    }
  }

  const summary = set.plans
    .map(
      (p) =>
        `${p.specShort}:${Math.round(p.fit * 100)}% (${p.bucketsUsed.high}H/${p.bucketsUsed.medium}M/${p.bucketsUsed.low}B)`,
    )
    .join("  ");
  console.log(`\n${label} — ${set.interestCount}/${set.totalCourseCount} ranked, ${set.uncovered.length} uncovered`);
  console.log(`  ${summary}`);
  return set;
}

// 1. The seeded example palette.
check("seeded example", loadInterests(db));

// 2. Everything in Highly interested.
check(
  "all 76 highly interested",
  new Map(catalog.courses.map((c) => [c.id, "high" as BucketId])),
);

// 3. Everything barely interested.
check(
  "all 76 barely interested",
  new Map(catalog.courses.map((c) => [c.id, "low" as BucketId])),
);

// 4. A graphics-flavoured palette.
check(
  "graphics-leaning",
  new Map<string, BucketId>([
    ["CS-6491", "high"],
    ["CS-7496", "high"],
    ["CS-6457", "high"],
    ["CS-6475", "medium"],
    ["CS-6515", "low"],
    ["CS-7470", "medium"],
  ]),
);

// 5. A systems-leaning palette.
check(
  "systems-leaning",
  new Map<string, BucketId>([
    ["CS-6200", "high"],
    ["CS-6210", "high"],
    ["CS-6250", "high"],
    ["CS-6290", "medium"],
    ["CS-6400", "medium"],
    ["CS-7210", "high"],
    ["CS-6515", "low"],
    ["CS-8803-O08", "medium"],
  ]),
);

// 6. Deliberately hostile: only HCI courses, nothing that fits other paths.
check(
  "hci-only",
  new Map<string, BucketId>([
    ["CS-6750", "high"],
    ["CS-7470", "high"],
    ["CS-6435", "high"],
    ["CS-6440", "high"],
    ["CS-6460", "medium"],
    ["CS-7632", "medium"],
    ["CS-6795", "low"],
    ["CS-7711", "low"],
  ]),
);

// 7. Smallest legal input.
check(
  "four courses",
  new Map<string, BucketId>([
    ["CS-7641", "high"],
    ["CS-7643", "high"],
    ["CS-6515", "low"],
    ["CS-6250", "low"],
  ]),
);

console.log("\nAll plan checks passed.");
db.close();
