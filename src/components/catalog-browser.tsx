import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
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

export function CatalogBrowser({
  courses,
  interests,
  coverage,
  onAssign,
  highlight,
}: {
  courses: Course[];
  interests: Record<string, BucketId>;
  coverage?: Record<string, number>;
  onAssign: (courseId: string, bucket: BucketId | null) => void;
  highlight?: Set<string>;
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
    <div className="flex h-full flex-col rounded-xl border border-border bg-card/40">
      <div className="space-y-2 border-b border-border/70 p-2.5">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${courses.length} courses, tags, descriptions…`}
          aria-label="Search courses"
          name="course-search"
          className="h-8 border-border/80 bg-background text-[12.5px]"
        />
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors",
                filter === f.id
                  ? "border-foreground/30 bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
          <span className="mx-1 h-3 w-px bg-border" />
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Filter by department"
            name="department-filter"
            className="h-5 rounded-sm border border-border bg-transparent px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground outline-none hover:text-foreground"
          >
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "Dept" : s}
              </option>
            ))}
          </select>
          <span className="ml-auto font-mono text-[9px] text-muted-foreground tabular-nums">
            {filtered.length}/{courses.length}
          </span>
        </div>
      </div>

      <div className="max-h-[520px] flex-1 space-y-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-[12px] font-medium text-muted-foreground">No courses match</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
                setSubject("all");
              }}
              className="mt-1 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
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
              dense
            />
          ))
        )}
      </div>

      {highlight && highlight.size > 0 && (
        <div className="border-t border-border/70 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {highlight.size} ranked courses sit outside every generated path
        </div>
      )}
    </div>
  );
}
