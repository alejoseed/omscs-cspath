import { PlannerApp } from "@/components/planner-app";
import { loadCatalogPayload } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

export default function Home() {
  // The catalog is static data, so it is rendered server-side and shipped with
  // the first response. No client fetch, no loading spinner, no failure mode
  // where the board waits forever on a request that never resolves.
  const payload = loadCatalogPayload();

  return (
    <div className="paper-grain flex flex-1 flex-col">
      <PlannerApp payload={payload} />
      <footer className="border-t border-border/70 px-4 py-3">
        <p className="mx-auto max-w-[1400px] font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          Course catalog and specialization rules from omscs.gatech.edu · not official GT
          advising
        </p>
      </footer>
    </div>
  );
}
