"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BucketBoard } from "@/components/bucket-board";
import { CatalogBrowser } from "@/components/catalog-browser";
import { PlanResults } from "@/components/plan-results";
import { BUCKET_META } from "@/components/course-row";
import { cn } from "@/lib/utils";
import type {
  BucketId,
  Course,
  PlanResponse,
  SpecSummary,
} from "@/lib/types";

interface CatalogPayload {
  courses: Course[];
  specializations: SpecSummary[];
  interests: Record<string, BucketId>;
  deepseekConfigured: boolean;
}

const MIN_RANKED = 4;

export function PlannerApp() {
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [interests, setInterests] = useState<Record<string, BucketId>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"board" | "catalog">("board");
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/catalog")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Catalog request failed (${res.status})`);
        return (await res.json()) as CatalogPayload;
      })
      .then((data) => {
        if (cancelled) return;
        setCatalog(data);
        setInterests(data.interests);
      })
      .catch((error: Error) => {
        if (!cancelled) setLoadError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const assign = useCallback(
    async (courseId: string, bucket: BucketId | null) => {
      const previous = interests;
      setInterests((current) => {
        const next = { ...current };
        if (bucket === null) delete next[courseId];
        else next[courseId] = bucket;
        return next;
      });
      setPending((p) => new Set(p).add(courseId));
      setResult(null);

      try {
        const res = await fetch("/api/interests", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ courseId, bucket }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Save failed (${res.status})`);
        }
      } catch (error) {
        // Roll back just this course, keeping any other edits that landed while
        // the request was in flight.
        setInterests((current) => {
          const next = { ...current };
          if (previous[courseId] === undefined) delete next[courseId];
          else next[courseId] = previous[courseId];
          return next;
        });
        setGenerateError(error instanceof Error ? error.message : "Could not save.");
      } finally {
        setPending((p) => {
          const next = new Set(p);
          next.delete(courseId);
          return next;
        });
      }
    },
    [interests],
  );

  const clearBucket = useCallback(
    (bucket: BucketId) => {
      const ids = Object.entries(interests)
        .filter(([, b]) => b === bucket)
        .map(([id]) => id);
      for (const id of ids) void assign(id, null);
    },
    [assign, interests],
  );

  const generate = useCallback(async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/plan", { method: "POST" });
      const body = (await res.json()) as PlanResponse & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Plan request failed (${res.status})`);
      setResult(body);
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "Could not generate plans.",
      );
    } finally {
      setGenerating(false);
    }
  }, []);

  const counts = useMemo(() => {
    const c: Record<BucketId, number> = { high: 0, medium: 0, low: 0 };
    for (const bucket of Object.values(interests)) c[bucket] += 1;
    return c;
  }, [interests]);

  const ranked = Object.keys(interests).length;
  const ready = ranked >= MIN_RANKED;

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-lg font-semibold">The catalog did not load</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{loadError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-md border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider hover:bg-accent"
        >
          Retry
        </button>
      </main>
    );
  }

  if (!catalog) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6">
        <div className="size-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
        <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Loading catalog from SQLite
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
              Georgia Tech · Online MS in Computer Science
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-[34px] leading-none tracking-tight sm:text-[42px]">
              Path Builder
            </h1>
            <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-muted-foreground">
              Rank every OMSCS course into three interest buckets. The solver builds a legal
              ten-course, thirty-credit plan for each specialization, then DeepSeek ranks the
              paths for you.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Ranked
              </p>
              <p className="font-mono text-lg leading-tight tabular-nums">
                {ranked}
                <span className="text-[11px] text-muted-foreground">
                  /{catalog.courses.length}
                </span>
              </p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex gap-2 font-mono text-[10px] tabular-nums">
              {(["high", "medium", "low"] as const).map((b) => (
                <div key={b} className="flex items-center gap-1">
                  <span className={cn("size-1.5 rounded-full", BUCKET_META[b].dot)} />
                  <span className="text-muted-foreground">{counts[b]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex gap-1 rounded-md border border-border bg-card/60 p-0.5">
              {(
                [
                  ["board", `Buckets (${ranked})`],
                  ["catalog", `Catalog (${catalog.courses.length})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "rounded-sm px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                    tab === id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                void fetch("/api/interests", { method: "DELETE" }).then(() => {
                  setInterests({});
                  setResult(null);
                });
              }}
              className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-destructive"
            >
              Reset all
            </button>
          </div>

          <div className={cn(tab === "board" ? "block" : "hidden lg:block")}>
            <BucketBoard
              courses={catalog.courses}
              interests={interests}
              coverage={result?.coverage}
              onAssign={assign}
              onClearBucket={clearBucket}
            />
          </div>

          <div className={cn("mt-2.5", tab === "catalog" ? "block" : "hidden lg:block")}>
            <CatalogBrowser
              courses={catalog.courses}
              interests={interests}
              coverage={result?.coverage}
              onAssign={assign}
              highlight={result ? new Set(result.uncovered) : undefined}
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[12px] font-medium">
                {ready
                  ? "Ready to solve all six specializations"
                  : `Rank ${MIN_RANKED - ranked} more course${MIN_RANKED - ranked === 1 ? "" : "s"} to unlock`}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {pending.size > 0
                  ? "Saving…"
                  : result
                    ? "Buckets changed? Re-run to refresh every path."
                    : "Every path is 10 courses / 30 credits and satisfies the official rules."}
              </p>
            </div>
            <button
              type="button"
              disabled={!ready || generating}
              onClick={() => void generate()}
              className={cn(
                "shrink-0 rounded-md px-4 py-2 font-mono text-[10.5px] uppercase tracking-widest transition-all",
                ready
                  ? "bg-foreground text-background hover:opacity-85"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
                generating && "opacity-70",
              )}
            >
              {generating ? "Solving…" : result ? "Re-run paths" : "Create path"}
            </button>
          </div>

          {generateError && (
            <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/[0.06] px-2.5 py-1.5 text-[11.5px] text-foreground/85">
              {generateError}
            </p>
          )}
        </div>

        <aside ref={resultsRef} className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          {result ? (
            <PlanResults result={result} onReset={() => setResult(null)} />
          ) : (
            <EmptyResults
              specializations={catalog.specializations}
              deepseekConfigured={catalog.deepseekConfigured}
            />
          )}
        </aside>
      </div>
    </main>
  );
}

function EmptyResults({
  specializations,
  deepseekConfigured,
}: {
  specializations: SpecSummary[];
  deepseekConfigured: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Ranked paths
        </h2>
        <span
          className={cn(
            "rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
            deepseekConfigured
              ? "border-high/40 bg-high/10 text-foreground/80"
              : "border-border text-muted-foreground",
          )}
        >
          {deepseekConfigured ? "DeepSeek ready" : "Solver only"}
        </span>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
        Once you sort at least four courses, press{" "}
        <span className="font-medium text-foreground">Create path</span>. You get one legal plan
        per specialization, ordered by how much of what you love it can fit in ten courses.
      </p>

      <div className="mt-4 space-y-1.5">
        {specializations.map((spec) => (
          <div
            key={spec.id}
            className="flex items-baseline justify-between gap-2 rounded-md border border-border/70 bg-background/40 px-2.5 py-1.5"
          >
            <span className="text-[12px] font-medium">{spec.name}</span>
            <span className="shrink-0 font-mono text-[9.5px] text-muted-foreground tabular-nums">
              {spec.credits} cr
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2 border-t border-border/70 pt-3">
        <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          How it works
        </p>
        {[
          "Drag courses into Highly / Moderately / Barely interested.",
          "A constraint solver satisfies each specialization's real course rules.",
          "Free electives are filled from your highest-weighted remaining picks.",
          "DeepSeek ranks the six plans and explains the trade-offs.",
        ].map((step, i) => (
          <div key={step} className="flex gap-2">
            <span className="font-mono text-[9px] text-muted-foreground tabular-nums">
              0{i + 1}
            </span>
            <span className="text-[11.5px] leading-snug text-foreground/75">{step}</span>
          </div>
        ))}
      </div>

      {!deepseekConfigured && (
        <div className="mt-3 rounded-md border border-dashed border-border px-2.5 py-2">
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            Optional
          </p>
          <p className="mt-1 text-[11px] leading-snug text-foreground/70">
            Add <code className="rounded bg-muted px-1 font-mono text-[10px]">DEEPSEEK_API_KEY</code>{" "}
            to <code className="rounded bg-muted px-1 font-mono text-[10px]">.env.local</code> and
            every path comes back with DeepSeek&apos;s written recommendation.
          </p>
        </div>
      )}
    </div>
  );
}
