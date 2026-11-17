import { getDb } from "@/lib/db";
import { loadCatalog, loadInterests } from "@/lib/planner";
import { deepseekConfigured } from "@/lib/llm";
import { BUCKETS } from "@/data/specializations";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const catalog = loadCatalog(db);

  return Response.json({
    courses: catalog.courses,
    specializations: catalog.specs.map((s) => ({
      id: s.id,
      name: s.name,
      shortName: s.shortName,
      credits: s.credits,
      blurb: s.blurb,
      url: s.url,
    })),
    buckets: BUCKETS,
    // The starter palette each visitor begins with; their edits stay in the
    // browser so one visitor never overwrites another's buckets.
    starterInterests: Object.fromEntries(loadInterests(db)),
    deepseekConfigured: deepseekConfigured(),
  });
}
