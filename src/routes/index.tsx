import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PlannerApp } from "@/components/planner-app";
import { catalogQueryOptions } from "@/lib/catalog.functions";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.query(catalogQueryOptions),
  component: Home,
});

function Home() {
  const { data: payload } = useSuspenseQuery(catalogQueryOptions);

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
