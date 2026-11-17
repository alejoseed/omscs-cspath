import { loadCatalogPayload } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await loadCatalogPayload());
}
