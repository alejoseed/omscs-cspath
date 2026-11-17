import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BucketBoard } from "@/components/bucket-board";
import { CatalogBrowser } from "@/components/catalog-browser";
import { PlanResults } from "@/components/plan-results";
import { BUCKET_META } from "@/components/course-row";
import { DeepseekKeyDialog, useDeepseekKey } from "@/components/deepseek-key-dialog";
import { cn } from "@/lib/utils";
import {
  clearInterests,
  getServerSnapshot,
  getSnapshot,
  saveInterests,
  subscribe,
} from "@/lib/interest-store";
import { createPlan } from "@/lib/plan.functions";
import type { BucketId, CatalogPayload } from "@/lib/types";

const MIN_RANKED = 4;

export function PlannerApp({ payload }: { payload: CatalogPayload }) {
  const catalog = payload;

  const saved = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [draft, setDraft] = useState<Record<string, BucketId> | null>(null);
  const interests = draft ?? saved ?? payload.starterInterests;

  const [tab, setTab] = useState<"board" | "catalog">("board");
  const resultsRef = useRef<HTMLDivElement>(null);

  const deepseekApiKey = useDeepseekKey();
  const createPlanFn = useServerFn(createPlan);
  const plan = useMutation({
    mutationFn: (current: Record<string, BucketId>) =>
      createPlanFn({
        data: { interests: current, deepseekApiKey: deepseekApiKey ?? undefined },
        signal: AbortSignal.timeout(45_000),
      }),
    onSuccess: () => {
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
  });
  const result = plan.data ?? null;
  const generating = plan.isPending;
  const generateError = plan.error
    ? plan.error.name === "TimeoutError" || plan.error.name === "AbortError"
      ? "The request timed out. Try again."
      : plan.error.message || "Could not generate plans."
    : null;
  const clearResult = plan.reset;

  const update = useCallback((next: Record<string, BucketId>) => {
    setDraft(next);
    saveInterests(next);
  }, []);

  const assign = useCallback(
    (courseId: string, bucket: BucketId | null) => {
      const next = { ...interests };
      if (bucket === null) delete next[courseId];
      else next[courseId] = bucket;
      update(next);
      clearResult();
    },
    [interests, update, clearResult],
  );

  const clearBucket = useCallback(
    (bucket: BucketId) => {
      const next = { ...interests };
      for (const [id, b] of Object.entries(next)) {
        if (b === bucket) delete next[id];
      }
      update(next);
      clearResult();
    },
    [interests, update, clearResult],
  );

  const resetAll = useCallback(() => {
    setDraft({});
    clearResult();
    clearInterests();
  }, [clearResult]);

  const counts = useMemo(() => {
    const c: Record<BucketId, number> = { high: 0, medium: 0, low: 0 };
    for (const bucket of Object.values(interests)) c[bucket] += 1;
    return c;
  }, [interests]);

  const ranked = Object.keys(interests).length;
  const ready = ranked >= MIN_RANKED;

  const label = generating
    ? "Solving…"
    : !ready
      ? `Rank ${MIN_RANKED - ranked} more`
      : result
        ? "Re-run paths"
        : "Create path";

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold">OMSCS Path Builder</h1>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs tabular-nums">
            <span>
              <span className="text-sm font-bold">{ranked}</span>
              <span className="text-muted-foreground">/{catalog.courses.length} ranked</span>
            </span>
            {(["high", "medium", "low"] as const).map((b) => (
              <span key={b} className="flex items-center gap-1 text-muted-foreground">
                <span className={cn("size-2 rounded-full", BUCKET_META[b].dot)} />
                {counts[b]}
              </span>
            ))}
          </div>
          <DeepseekKeyDialog />
        </div>
      </header>

      <div className="flex gap-1 self-start rounded-md border border-border bg-card/60 p-1 lg:hidden">
        {(
          [
            ["board", `Buckets (${ranked})`],
            ["catalog", `Catalog (${catalog.courses.length})`],
          ] as const
        ).map(([id, text]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-sm p-2 text-xs leading-none font-bold transition-colors",
              tab === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:h-[calc(100dvh-6rem)] lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div
          className={cn(
            "min-h-0 min-w-0 flex-col gap-3",
            tab === "board" ? "flex" : "hidden lg:flex",
          )}
        >
          <div className="min-h-0 flex-1">
            <BucketBoard
              courses={catalog.courses}
              interests={interests}
              coverage={result?.coverage}
              onAssign={assign}
              onClearBucket={clearBucket}
            />
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3">
            <button
              type="button"
              disabled={!ready || generating}
              onClick={() => plan.mutate(interests)}
              className={cn(
                "shrink-0 rounded-md p-3 text-sm leading-none font-bold transition-opacity",
                ready
                  ? "bg-foreground text-background hover:opacity-85"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
                generating && "opacity-70",
              )}
            >
              {label}
            </button>
            {generateError && (
              <p className="min-w-0 truncate text-sm text-destructive">{generateError}</p>
            )}
            <button
              type="button"
              onClick={resetAll}
              className="ml-auto shrink-0 rounded-md p-2 text-xs leading-none text-muted-foreground transition-colors hover:text-destructive"
            >
              Reset all
            </button>
          </div>
        </div>

        <aside className={cn("min-h-0 min-w-0", tab === "catalog" ? "block" : "hidden lg:block")}>
          <CatalogBrowser
            courses={catalog.courses}
            interests={interests}
            coverage={result?.coverage}
            onAssign={assign}
          />
        </aside>
      </div>

      {result && (
        <div ref={resultsRef} className="scroll-mt-6">
          <PlanResults result={result} onReset={clearResult} />
        </div>
      )}
    </main>
  );
}
