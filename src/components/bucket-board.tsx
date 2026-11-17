"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { CourseRow, BUCKET_META } from "@/components/course-row";
import type { BucketId, Course } from "@/lib/types";

const ORDER: BucketId[] = ["high", "medium", "low"];

interface BucketColumnProps {
  bucket: BucketId;
  courses: Course[];
  coverage?: Record<string, number>;
  onAssign: (courseId: string, bucket: BucketId | null) => void;
  onDropCourse: (courseId: string, bucket: BucketId) => void;
  onClear: () => void;
}

export function BucketColumn({
  bucket,
  courses,
  coverage,
  onAssign,
  onDropCourse,
  onClear,
}: BucketColumnProps) {
  const [over, setOver] = useState(false);
  const meta = BUCKET_META[bucket];

  return (
    <section
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("text/plain")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setOver(true);
        }
      }}
      onDragLeave={(event) => {
        // dragleave fires when moving onto a child element, which would clear
        // the highlight mid-drag. Only clear it when the pointer really left.
        const next = event.relatedTarget as Node | null;
        if (next && event.currentTarget.contains(next)) return;
        setOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const id = event.dataTransfer.getData("text/plain");
        if (id) onDropCourse(id, bucket);
      }}
      className={cn(
        "flex min-h-[220px] flex-col rounded-xl border bg-card/60 transition-colors",
        over ? cn(meta.ring, meta.wash, "border-dashed") : "border-border",
      )}
    >
      <header className="flex items-start justify-between gap-2 border-b border-border/70 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", meta.dot)} />
            <h3 className="text-[13px] font-semibold tracking-tight">{meta.label}</h3>
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
              {courses.length}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{meta.hint}</p>
        </div>
        {courses.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-destructive"
          >
            Clear
          </button>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
        {courses.length === 0 ? (
          <div
            className={cn(
              "flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed px-3 py-6 text-center",
              over ? "border-foreground/30" : "border-border/80",
            )}
          >
            <p className="text-[11px] font-medium text-muted-foreground">
              {over ? "Drop to assign" : "Drag courses here"}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground/70">
              or use the H / M / B buttons
            </p>
          </div>
        ) : (
          courses.map((course) => (
            <CourseRow
              key={course.id}
              course={course}
              bucket={bucket}
              onAssign={onAssign}
              inPlan={(coverage?.[course.id] ?? 0) > 0}
              score={coverage?.[course.id] ?? 0}
              dense
            />
          ))
        )}
      </div>
    </section>
  );
}

export function BucketBoard({
  courses,
  interests,
  coverage,
  onAssign,
  onClearBucket,
}: {
  courses: Course[];
  interests: Record<string, BucketId>;
  coverage?: Record<string, number>;
  onAssign: (courseId: string, bucket: BucketId | null) => void;
  onClearBucket: (bucket: BucketId) => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<BucketId, Course[]> = { high: [], medium: [], low: [] };
    const byId = new Map(courses.map((c) => [c.id, c]));
    for (const [id, bucket] of Object.entries(interests)) {
      const course = byId.get(id);
      if (course) map[bucket].push(course);
    }
    return map;
  }, [courses, interests]);

  return (
    <div className="grid gap-2.5 md:grid-cols-3">
      {ORDER.map((bucket) => (
        <BucketColumn
          key={bucket}
          bucket={bucket}
          courses={grouped[bucket]}
          coverage={coverage}
          onAssign={onAssign}
          onDropCourse={(courseId, b) => onAssign(courseId, b)}
          onClear={() => onClearBucket(bucket)}
        />
      ))}
    </div>
  );
}
