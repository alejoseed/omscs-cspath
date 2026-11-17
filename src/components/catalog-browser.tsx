import { useMemo, useState } from "react";
import { CourseRow } from "@/components/course-row";
import { cn } from "@/lib/utils";
import type { BucketId, Course } from "@/lib/types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "foundational", label: "Foundational" },
  { id: "unassigned", label: "Unranked" },
  { id: "assigned", label: "Ranked" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const chip = "rounded-md border p-2 text-xs leading-none transition-colors";

export function CatalogBrowser({
  courses,
  interests,
  coverage,
  onAssign,
}: {
  courses: Course[];
  interests: Record<string, BucketId>;
  coverage?: Record<string, number>;
  onAssign: (courseId: string, bucket: BucketId | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [subject, setSubject] = useState<string>("all");

  const subjects = useMemo(
    () => ["all", ...new Set(courses.map((c) => c.subject))],
    [courses],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((course) => {
      if (subject !== "all" && course.subject !== subject) return false;
      if (filter === "foundational" && !course.foundational) return false;
      if (filter === "unassigned" && interests[course.id]) return false;
      if (filter === "assigned" && !interests[course.id]) return false;
      if (!q) return true;
      return (
        course.title.toLowerCase().includes(q) ||
        course.id.toLowerCase().includes(q) ||
        course.tags.some((t) => t.toLowerCase().includes(q)) ||
        course.description.toLowerCase().includes(q)
      );
    });
  }, [courses, query, filter, subject, interests]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-card/40">
      <div className="flex flex-col gap-2 border-b border-border/70 p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search courses"
          aria-label="Search courses"
          name="course-search"
          className="w-full rounded-md border border-border/80 bg-background p-2 text-sm leading-none outline-none placeholder:text-muted-foreground focus:border-foreground/40"
        />
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                chip,
                filter === f.id
                  ? "border-foreground/30 bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Filter by department"
            name="department-filter"
            className={cn(chip, "border-border bg-transparent text-muted-foreground outline-none hover:text-foreground")}
          >
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "Dept" : s}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {filtered.length}/{courses.length}
          </span>
        </div>
      </div>

      <div className="flex max-h-[70dvh] min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 lg:max-h-none">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <p className="text-sm text-muted-foreground">No courses match</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
                setSubject("all");
              }}
              className="rounded-sm p-1 text-xs leading-none text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          filtered.map((course) => (
            <CourseRow
              key={course.id}
              course={course}
              bucket={interests[course.id] ?? null}
              onAssign={onAssign}
              inPlan={(coverage?.[course.id] ?? 0) > 0}
              score={coverage?.[course.id] ?? 0}
            />
          ))
        )}
      </div>
    </div>
  );
}
