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
  { label: string; short: string; dot: string; ring: string; wash: string }
> = {
  high: {
    label: "Highly interested",
    short: "H",
    dot: "bg-high",
    ring: "border-high/45",
    wash: "bg-high/[0.07]",
  },
  medium: {
    label: "Moderately interested",
    short: "M",
    dot: "bg-medium",
    ring: "border-medium/45",
    wash: "bg-medium/[0.07]",
  },
  low: {
    label: "Barely interested",
    short: "B",
    dot: "bg-low",
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
}

export function CourseRow({ course, bucket, onAssign, inPlan, score }: CourseRowProps) {
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
        "group flex cursor-grab items-center gap-2 rounded-md border bg-card p-2 transition-colors active:cursor-grabbing",
        meta ? cn(meta.ring, meta.wash) : "border-border hover:border-foreground/25",
        dragging && "opacity-40",
      )}
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          meta ? meta.dot : "border border-muted-foreground/40",
        )}
      />
      <span className="shrink-0 text-xs font-bold text-muted-foreground tabular-nums">
        {course.subject} {course.number}
      </span>
      <button
        type="button"
        onClick={() => onAssign(course.id, bucket ? null : "high")}
        className="min-w-0 flex-1 truncate text-left text-sm text-foreground hover:underline"
        title={bucket ? "Click to unassign" : "Click to add to Highly interested"}
      >
        {course.title}
      </button>

      {course.foundational && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="shrink-0 text-xs font-bold text-foreground/45">F</span>
          </TooltipTrigger>
          <TooltipContent side="left">
            Foundational — 2 required with a B or better in your first year
          </TooltipContent>
        </Tooltip>
      )}

      {inPlan && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="size-2 shrink-0 rounded-full bg-foreground/80" />
          </TooltipTrigger>
          <TooltipContent side="left">Appears in {score} of the ranked plans</TooltipContent>
        </Tooltip>
      )}

      <div className="hidden shrink-0 gap-1 group-focus-within:flex group-hover:flex pointer-coarse:flex">
        {(["high", "medium", "low"] as const).map((b) => (
          <button
            key={b}
            type="button"
            aria-label={BUCKET_META[b].label}
            onClick={() => onAssign(course.id, bucket === b ? null : b)}
            className={cn(
              "flex size-6 items-center justify-center rounded-sm border text-xs leading-none font-bold transition-colors",
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
