import { getD1 } from "@/lib/d1.server";
import { loadCatalog, loadInterests } from "@/lib/planner";
import { deepseekConfigured } from "@/lib/llm.server";
import { BUCKETS } from "@/data/specializations";
import type { BucketId, CatalogPayload } from "@/lib/types";

export async function loadCatalogPayload(): Promise<CatalogPayload> {
  const db = getD1();
  const [catalog, interests] = await Promise.all([
    loadCatalog(db),
    loadInterests(db),
  ]);

  return {
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
    starterInterests: Object.fromEntries(interests) as Record<string, BucketId>,
    deepseekConfigured: deepseekConfigured(),
  };
}
