import { createFileRoute } from "@tanstack/react-router";
import { loadCatalogPayload } from "@/lib/catalog.server";

export const Route = createFileRoute("/api/catalog")({
  server: {
    handlers: {
      GET: async () => Response.json(await loadCatalogPayload()),
    },
  },
});
