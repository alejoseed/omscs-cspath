import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { loadCatalogPayload } from "@/lib/catalog.server";

export const getCatalog = createServerFn({ method: "GET" }).handler(() => loadCatalogPayload());

/**
 * The catalog is static data, so it never goes stale within a session. The
 * index loader fills this during SSR and the cache is hydrated on the client:
 * no client fetch, no loading spinner.
 */
export const catalogQueryOptions = queryOptions({
  queryKey: ["catalog"],
  queryFn: () => getCatalog(),
  staleTime: "static",
});
