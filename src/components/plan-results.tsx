import { useState } from "react";
import { cn } from "@/lib/utils";
import { BUCKET_META } from "@/components/course-row";
import type { Plan, PlanCourse, PlanResponse } from "@/lib/types";

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function warningText(warning: string): string {
  if (/\b401\b/.test(warning)) return "DeepSeek rejected your key. Showing the solver ranking.";
  if (/timed out/i.test(warning)) return "DeepSeek timed out. Showing the solver ranking.";
  return "DeepSeek failed. Showing the solver ranking.";
}

function CourseList({ title, courses, dashed }: { title: string; courses: PlanCourse[]; dashed?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-bold text-muted-foreground">
        {title} · {courses.length}
      </h4>
      <ul className="flex flex-col gap-1">
        {courses.map((c) => (
          <li
            key={c.id}
            className={cn(
              "flex items-center gap-2 rounded-md border p-2",
              dashed ? "border-dashed border-border" : "border-border/70",
            )}
          >
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                c.bucket ? BUCKET_META[c.bucket].dot : "bg-muted-foreground/30",
              )}
            />
            <span className="shrink-0 text-xs font-bold text-muted-foreground tabular-nums">
              {c.subject} {c.number}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
          </li>
        ))}
        {courses.length === 0 && (
          <li className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
            None
          </li>
        )}
      </ul>
    </div>
  );
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
  return (
    <article
      className={cn(
        "rounded-xl border bg-card transition-shadow",
        plan.rank === 1 ? "border-foreground/25 shadow-sm" : "border-border",
      )}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-4 p-4 text-left">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold tabular-nums",
            plan.rank === 1
              ? "border-foreground/30 bg-foreground text-background"
              : "border-border text-muted-foreground",
          )}
        >
          {plan.rank}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold">{plan.specName}</h3>
            <span className="rounded-sm bg-muted p-1 text-xs leading-none text-muted-foreground">
              {plan.credits} cr spec
            </span>
          </div>
          {plan.headline && <p className="text-sm text-foreground/80">{plan.headline}</p>}

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground tabular-nums">
            <span>
              Match <span className="font-bold text-foreground">{pct(plan.fit)}</span>
            </span>
            <span>
              Your courses{" "}
              <span className="font-bold text-foreground">
                {plan.coverage}/{total}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-high">{plan.bucketsUsed.high}H</span>
              <span className="text-medium">{plan.bucketsUsed.medium}M</span>
              <span className="text-low">{plan.bucketsUsed.low}B</span>
            </span>
            {plan.foundationalCount < 2 && (
              <span className="text-destructive">Needs 2 foundational</span>
            )}
          </div>

          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground/70" style={{ width: pct(plan.fit) }} />
          </div>
        </div>

        <span
          className={cn(
            "shrink-0 text-xs text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-border/70 p-4">
          {plan.rationale && <p className="text-sm text-foreground/85">{plan.rationale}</p>}

          {plan.watchOuts.length > 0 && (
            <ul className="flex flex-col gap-1">
              {plan.watchOuts.map((w) => (
                <li
                  key={w}
                  className="flex gap-2 rounded-md border border-destructive/25 bg-destructive/[0.05] p-2 text-sm text-foreground/85"
                >
                  <span className="font-bold text-destructive">!</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <CourseList
              title="Specialization"
              courses={plan.courses.filter((c) => c.role === "specialization")}
            />
            <CourseList
              title="Free electives"
              courses={plan.courses.filter((c) => c.role === "free")}
              dashed
            />
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-muted-foreground">Requirements</h4>
              <ul className="flex flex-col gap-1 rounded-lg border border-border/70 bg-muted/40 p-3">
                {plan.requirements.map((req) => (
                  <li key={req.id} className="text-xs">
                    <span className="font-bold text-high">✓</span>{" "}
                    <span className="text-foreground/70">{req.label}</span>
                    <span className="text-muted-foreground"> — {req.courses.join(", ")}</span>
                  </li>
                ))}
              </ul>
              <a
                href={plan.specUrl}
                target="_blank"
                rel="noreferrer"
                className="w-fit text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Official requirements ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export function PlanResults({ result, onReset }: { result: PlanResponse; onReset: () => void }) {
  const [expanded, setExpanded] = useState<number | null>(1);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-xl border border-foreground/15 bg-accent/40 p-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold text-muted-foreground">
            {result.engine === "deepseek" ? "Ranked by DeepSeek" : "Ranked by solver"}
            {result.model ? ` · ${result.model}` : ""}
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {result.plans.length} paths · {result.interestCount} ranked courses
          </span>
          <button
            type="button"
            onClick={onReset}
            className="ml-auto rounded-md p-2 text-xs leading-none text-muted-foreground hover:text-foreground"
          >
            Clear results
          </button>
        </div>
        <p className="text-sm text-foreground/90">{result.summary}</p>
        {result.warning && <p className="text-xs text-destructive">{warningText(result.warning)}</p>}
        {result.uncovered.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              {result.uncovered.length} ranked course{result.uncovered.length === 1 ? "" : "s"} missing
              from every path
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">
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
    </section>
  );
}
