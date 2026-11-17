import { getDb } from "@/lib/db";
import { loadCatalog, loadInterests } from "@/lib/planner";
import { deepseekConfigured } from "@/lib/llm";
import { BUCKETS } from "@/data/specializations";
import type { BucketId, Course, SpecSummary } from "@/lib/types";

export interface CatalogPayload {
  courses: Course[];
  specializations: SpecSummary[];
  buckets: typeof BUCKETS;
  starterInterests: Record<string, BucketId>;
  deepseekConfigured: boolean;
}

/**
 * Loads everything the board needs on the server, so the page is complete in the
 * first HTML response. The catalog is static data derived from src/data, so
 * there is no reason to make the browser fetch it and sit on a spinner.
 */
export function loadCatalogPayload(): CatalogPayload {
  const db = getDb();
  const catalog = loadCatalog(db);

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
    starterInterests: Object.fromEntries(loadInterests(db)) as Record<string, BucketId>,
    deepseekConfigured: deepseekConfigured(),
  };
}
