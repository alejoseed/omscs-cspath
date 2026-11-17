import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { loadCatalogPayload } from "@/lib/catalog.server";

export const getCatalog = createServerFn({ method: "GET" }).handler(() => loadCatalogPayload());

export const catalogQueryOptions = queryOptions({
  queryKey: ["catalog"],
  queryFn: () => getCatalog(),
  staleTime: "static",
});
