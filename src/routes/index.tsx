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
    </div>
  );
}
