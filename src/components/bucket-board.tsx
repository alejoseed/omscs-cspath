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
        "flex min-h-60 flex-col rounded-xl border bg-card/60 transition-colors lg:min-h-0",
        over ? cn(meta.ring, meta.wash, "border-dashed") : "border-border",
      )}
    >
      <header className="flex items-center gap-2 border-b border-border/70 p-3">
        <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} />
        <h3 className="truncate text-sm font-bold">{meta.label}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{courses.length}</span>
        {courses.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto shrink-0 rounded-sm p-1 text-xs leading-none text-muted-foreground transition-colors hover:text-destructive"
          >
            Clear
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {courses.length === 0 ? (
          <div
            className={cn(
              "flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-xs text-muted-foreground",
              over ? "border-foreground/30" : "border-border/80",
            )}
          >
            {over ? "Drop to assign" : "Drop courses here"}
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
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:h-full lg:min-h-0">
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
