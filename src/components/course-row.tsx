import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BucketId, Course } from "@/lib/types";

export const BUCKET_META: Record<
  BucketId,
  { label: string; short: string; hint: string; dot: string; text: string; ring: string; wash: string }
> = {
  high: {
    label: "Highly interested",
    short: "Highly",
    hint: "Would take even if it were not on a path",
    dot: "bg-high",
    text: "text-high",
    ring: "border-high/45",
    wash: "bg-high/[0.07]",
  },
  medium: {
    label: "Moderately interested",
    short: "Moderately",
    hint: "Good options — take if the plan wants them",
    dot: "bg-medium",
    text: "text-medium",
    ring: "border-medium/45",
    wash: "bg-medium/[0.07]",
  },
  low: {
    label: "Barely interested",
    short: "Barely",
    hint: "Fallbacks you would tolerate to graduate",
    dot: "bg-low",
    text: "text-low",
    ring: "border-low/35",
    wash: "bg-low/[0.06]",
  },
};

interface CourseRowProps {
  course: Course;
  bucket: BucketId | null;
  onAssign: (courseId: string, bucket: BucketId | null) => void;
  inPlan?: boolean;
  score?: number;
  dense?: boolean;
}

export function CourseRow({
  course,
  bucket,
  onAssign,
  inPlan,
  score,
  dense = false,
}: CourseRowProps) {
  const [dragging, setDragging] = useState(false);
  const meta = bucket ? BUCKET_META[bucket] : null;

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", course.id);
        event.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={cn(
        "group relative cursor-grab rounded-md border bg-card px-2.5 py-2 transition-all active:cursor-grabbing",
        meta ? cn(meta.ring, meta.wash) : "border-border hover:border-foreground/25",
        dragging && "opacity-40",
        dense ? "py-1.5" : "py-2",
      )}
    >
      <div className="flex items-center gap-2">
        {meta ? (
          <span className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} />
        ) : (
          <span className="size-1.5 shrink-0 rounded-full border border-muted-foreground/40" />
        )}
        <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground tabular-nums">
          {course.subject} {course.number}
        </span>
        <button
          type="button"
          onClick={() => onAssign(course.id, bucket ? null : "high")}
          className="min-w-0 flex-1 truncate text-left text-[12.5px] font-medium text-foreground hover:underline"
          title={bucket ? "Click to unassign" : "Click to add to Highly interested"}
        >
          {course.title}
        </button>

        {course.foundational && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-foreground/45">
                F
              </span>
            </TooltipTrigger>
            <TooltipContent side="left">
              Foundational — 2 required with a B or better in your first year
            </TooltipContent>
          </Tooltip>
        )}

        {inPlan && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="size-1.5 shrink-0 rounded-full bg-foreground/80" />
            </TooltipTrigger>
            <TooltipContent side="left">
              Appears in {score} of the ranked plans
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        {(["high", "medium", "low"] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => onAssign(course.id, bucket === b ? null : b)}
            className={cn(
              "rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors",
              bucket === b
                ? "border-foreground/30 bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {BUCKET_META[b].short}
          </button>
        ))}
      </div>
    </div>
  );
}
