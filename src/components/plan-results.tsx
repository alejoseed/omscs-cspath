"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BUCKET_META } from "@/components/course-row";
import type { Plan, PlanResponse } from "@/lib/types";

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function PlanCard({
  plan,
  total,
  expanded,
  onToggle,
}: {
  plan: Plan;
  total: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const specializationCourses = plan.courses.filter((c) => c.role === "specialization");
  const freeCourses = plan.courses.filter((c) => c.role === "free");

  return (
    <article
      className={cn(
        "rounded-xl border bg-card transition-shadow",
        plan.rank === 1 ? "border-foreground/25 shadow-sm" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
      >
        <span
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] tabular-nums",
            plan.rank === 1
              ? "border-foreground/30 bg-foreground text-background"
              : "border-border text-muted-foreground",
          )}
        >
          {plan.rank}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[15px] font-semibold tracking-tight">{plan.specName}</h3>
            <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
              {plan.credits} cr spec · 30 cr total
            </span>
          </div>
          {plan.headline && (
            <p className="mt-0.5 text-[12.5px] text-foreground/80">{plan.headline}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[10px] text-muted-foreground">
            <span className="tabular-nums">
              interest match <span className="text-foreground">{pct(plan.fit)}</span>
            </span>
            <span className="text-border">|</span>
            <span className="tabular-nums">
              your courses <span className="text-foreground">{plan.coverage}/{total}</span>
            </span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1.5 tabular-nums">
              <span className="text-high">{plan.bucketsUsed.high}H</span>
              <span className="text-medium">{plan.bucketsUsed.medium}M</span>
              <span className="text-low">{plan.bucketsUsed.low}B</span>
            </span>
            {plan.foundationalCount < 2 && (
              <>
                <span className="text-border">|</span>
                <span className="text-destructive">needs 2 foundational</span>
              </>
            )}
          </div>

          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground/70"
              style={{ width: pct(plan.fit) }}
            />
          </div>
        </div>

        <span
          className={cn(
            "mt-1 shrink-0 font-mono text-[10px] text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border/70 px-4 pb-4 pt-3">
          {plan.rationale && (
            <p className="mb-3 text-[12.5px] leading-relaxed text-foreground/85">
              {plan.rationale}
            </p>
          )}

          {plan.watchOuts.length > 0 && (
            <ul className="mb-3 space-y-1">
              {plan.watchOuts.map((w) => (
                <li
                  key={w}
                  className="flex gap-2 rounded-md border border-destructive/25 bg-destructive/[0.05] px-2.5 py-1.5 text-[11.5px] leading-snug text-foreground/85"
                >
                  <span className="font-mono text-[10px] text-destructive">!</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <h4 className="mb-1.5 font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                Specialization · {specializationCourses.length} courses
              </h4>
              <ul className="space-y-1">
                {specializationCourses.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-1"
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        c.bucket ? BUCKET_META[c.bucket].dot : "bg-muted-foreground/30",
                      )}
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {c.subject} {c.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px]">{c.title}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-1.5 font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                Free electives · {freeCourses.length} courses
              </h4>
              <ul className="space-y-1">
                {freeCourses.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-1"
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        c.bucket ? BUCKET_META[c.bucket].dot : "bg-muted-foreground/30",
                      )}
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {c.subject} {c.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px]">{c.title}</span>
                  </li>
                ))}
                {freeCourses.length === 0 && (
                  <li className="rounded-md border border-dashed border-border px-2 py-2 text-[11px] text-muted-foreground">
                    No free slots — this specialization uses all ten.
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-border/70 bg-muted/40 p-2.5">
            <h4 className="mb-1.5 font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
              Requirements checked
            </h4>
            <ul className="space-y-0.5">
              {plan.requirements.map((req) => (
                <li key={req.id} className="flex items-start gap-1.5 text-[11px]">
                  <span className="mt-px font-mono text-[9px] text-high">ok</span>
                  <span className="text-foreground/70">
                    {req.label}
                    <span className="text-muted-foreground"> — {req.courses.join(", ")}</span>
                  </span>
                </li>
              ))}
            </ul>
            <a
              href={plan.specUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Official requirements ↗
            </a>
          </div>
        </div>
      )}
    </article>
  );
}

export function PlanResults({
  result,
  onReset,
}: {
  result: PlanResponse;
  onReset: () => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(1);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-foreground/15 bg-accent/40 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {result.engine === "deepseek" ? "DeepSeek ranking" : "Solver ranking"}
            {result.model ? ` · ${result.model}` : ""}
          </h2>
          <button
            type="button"
            onClick={onReset}
            className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Clear results
          </button>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/90">{result.summary}</p>
        {result.warning && (
          <p className="mt-1.5 font-mono text-[10px] leading-snug text-destructive">
            DeepSeek call failed ({result.warning}) — showing the deterministic solver
            ranking instead.
          </p>
        )}
        {!result.deepseekConfigured && (
          <p className="mt-1.5 font-mono text-[10px] leading-snug text-muted-foreground">
            No DEEPSEEK_API_KEY configured — plans are solver-ranked. Add the key and re-run
            for advisor commentary.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>
            {result.interestCount} ranked courses of {result.totalCourseCount}
          </span>
          <span className="text-border">|</span>
          <span>{result.plans.length} specializations solved</span>
          <span className="text-border">|</span>
          <span>10 courses · 30 credits each</span>
        </div>
        {result.uncovered.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
              {result.uncovered.length} ranked course
              {result.uncovered.length === 1 ? "" : "s"} missing from every path
            </summary>
            <p className="mt-1 font-mono text-[10px] leading-relaxed text-muted-foreground">
              {result.uncovered.map((id) => id.replace("-", " ")).join(" · ")}
            </p>
          </details>
        )}
      </div>

      {result.plans.map((plan) => (
        <PlanCard
          key={plan.specId}
          plan={plan}
          total={result.interestCount}
          expanded={expanded === plan.rank}
          onToggle={() => setExpanded(expanded === plan.rank ? null : plan.rank)}
        />
      ))}
    </div>
  );
}
