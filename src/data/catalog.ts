import { COURSES } from "@/data/courses";
import { SPECIALIZATIONS } from "@/data/specializations";
import type { Catalog, Course, SpecDef } from "@/lib/planner";

export function buildCatalogFromData(): Catalog {
  const courses: Course[] = COURSES.map((c) => ({
    id: c.id,
    subject: c.subject,
    number: c.number,
    title: c.title,
    credits: c.credits,
    foundational: c.foundational,
    admin: c.admin,
    description: c.description,
    tags: c.tags,
  }));

  const specs: SpecDef[] = SPECIALIZATIONS.map((s) => ({
    id: s.id,
    name: s.name,
    shortName: s.shortName,
    credits: s.credits,
    blurb: s.blurb,
    url: s.url,
    flavourTags: s.flavourTags,
    requirements: s.requirements.map((r) => ({
      id: `${s.id}:${r.id}`,
      type: r.type,
      label: r.label,
      n: r.type === "nOf" || r.type === "nOfWithEach" ? r.n : null,
      from:
        r.type === "nOfWithEach"
          ? [...new Set(r.groups.flatMap((g) => g.from))]
          : r.from,
      groups: r.type === "nOfWithEach" ? r.groups : [],
    })),
  }));

  return {
    courses,
    byId: new Map(courses.map((c) => [c.id, c])),
    specs,
  };
}

export const STARTER_INTERESTS: Record<string, "high" | "medium" | "low"> = {
  "CS-7641": "high",
  "CS-7643": "high",
  "CS-6601": "high",
  "CS-7650": "high",
  "CS-6476": "medium",
  "CS-8803-O27": "medium",
  "CS-6750": "medium",
  "CS-6603": "medium",
  "CS-6515": "low",
  "CS-6250": "low",
  "CS-6310": "low",
};
