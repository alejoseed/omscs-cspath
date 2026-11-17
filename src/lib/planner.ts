import type { Db } from "@/lib/db";
import { BUCKETS, UNASSIGNED_WEIGHT } from "@/data/specializations";

export interface Course {
  id: string;
  subject: string;
  number: string;
  title: string;
  credits: number;
  foundational: boolean;
  admin: string;
  description: string;
  tags: string[];
}

export interface ReqGroup {
  label: string;
  from: string[];
}

export interface ReqDef {
  id: string;
  type: "oneOf" | "all" | "nOf" | "nOfWithEach";
  label: string;
  n: number | null;
  from: string[];
  groups: ReqGroup[];
}

export interface SpecDef {
  id: string;
  name: string;
  shortName: string;
  credits: number;
  blurb: string;
  url: string;
  flavourTags: string[];
  requirements: ReqDef[];
}

export interface Catalog {
  courses: Course[];
  byId: Map<string, Course>;
  specs: SpecDef[];
}

export type BucketId = (typeof BUCKETS)[number]["id"];

export interface BucketRef {
  bucket: BucketId | null;
  weight: number;
}

export interface PlanCourse {
  id: string;
  title: string;
  subject: string;
  number: string;
  foundational: boolean;
  bucket: BucketId | null;
  weight: number;
  role: "specialization" | "free";
  requirement: string | null;
}

export interface RequirementResult {
  id: string;
  label: string;
  satisfied: boolean;
  courses: string[];
}

export interface Plan {
  specId: string;
  specName: string;
  specShort: string;
  specUrl: string;
  credits: number;
  courses: PlanCourse[];
  requirements: RequirementResult[];
  interestScore: number;
  maxInterestScore: number;
  fit: number;
  bucketsUsed: Record<BucketId, number>;
  coverage: number;
  freeCourses: number;
  foundationalCount: number;
  totalCredits: number;
  rank?: number;
}

export const DEGREE_COURSES = 10;
/** "A maximum of 6 credit hours may be taken with a subject code other than CS or CSE." */
export const MAX_NON_CS_COURSES = 2;

export function countsTowardCap(courseId: string): boolean {
  const subject = courseId.split("-")[0];
  return subject !== "CS" && subject !== "CSE";
}

export function loadCatalog(db: Db): Catalog {
  const courseRows = db
    .prepare(
      `SELECT id, subject, number, title, credits, foundational, admin, description, tags
       FROM courses ORDER BY subject, number`,
    )
    .all() as (Omit<Course, "foundational" | "tags"> & {
    foundational: number;
    tags: string;
  })[];

  const courses: Course[] = courseRows.map((row) => ({
    ...row,
    foundational: Boolean(row.foundational),
    tags: JSON.parse(row.tags) as string[],
  }));
  const byId = new Map(courses.map((c) => [c.id, c]));

  const specRows = db
    .prepare(
      `SELECT id, name, short_name AS shortName, credits, blurb, url, flavour AS flavourTags
       FROM specializations`,
    )
    .all() as (Omit<SpecDef, "requirements" | "flavourTags"> & {
    flavourTags: string;
  })[];

  const reqRows = db
    .prepare(
      `SELECT id, specialization_id AS specId, kind, label, n
       FROM requirements ORDER BY specialization_id, position`,
    )
    .all() as {
    id: string;
    specId: string;
    kind: ReqDef["type"];
    label: string;
    n: number | null;
  }[];

  const reqCourseRows = db
    .prepare(
      `SELECT requirement_id AS reqId, group_id AS groupId, course_id AS courseId
       FROM requirement_courses ORDER BY requirement_id, position`,
    )
    .all() as { reqId: string; groupId: string | null; courseId: string }[];

  const groupRows = db
    .prepare(
      `SELECT id, requirement_id AS reqId, label FROM requirement_groups ORDER BY requirement_id, position`,
    )
    .all() as { id: string; reqId: string; label: string }[];

  const specs: SpecDef[] = specRows.map((s) => {
    const requirements = reqRows
      .filter((r) => r.specId === s.id)
      .map<ReqDef>((r) => {
        const groups = groupRows
          .filter((g) => g.reqId === r.id)
          .map<ReqGroup>((g) => ({
            label: g.label,
            from: reqCourseRows
              .filter((rc) => rc.groupId === g.id)
              .map((rc) => rc.courseId),
          }));
        const from = groups.length
          ? groups.flatMap((g) => g.from)
          : reqCourseRows
              .filter((rc) => rc.reqId === r.id && rc.groupId === null)
              .map((rc) => rc.courseId);
        return {
          id: r.id,
          type: r.kind,
          label: r.label,
          n: r.n,
          from: [...new Set(from)],
          groups,
        };
      });
    return {
      id: s.id,
      name: s.name,
      shortName: s.shortName,
      credits: s.credits,
      blurb: s.blurb,
      url: s.url,
      flavourTags: JSON.parse(s.flavourTags) as string[],
      requirements,
    };
  });

  return { courses, byId, specs };
}

export function loadInterests(db: Db): Map<string, BucketId> {
  const rows = db
    .prepare("SELECT course_id AS courseId, bucket_id AS bucketId FROM course_interests")
    .all() as { courseId: string; bucketId: BucketId }[];
  return new Map(rows.map((r) => [r.courseId, r.bucketId]));
}

const WEIGHT: Record<BucketId, number> = Object.fromEntries(
  BUCKETS.map((b) => [b.id, b.weight]),
) as Record<BucketId, number>;

export function weightOf(bucket: BucketId | null | undefined): number {
  return bucket ? WEIGHT[bucket] : UNASSIGNED_WEIGHT;
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k <= 0) return [[]];
  if (items.length < k) return [];
  if (items.length === k) return [items.slice()];
  const result: T[][] = [];
  const current: T[] = [];
  const walk = (start: number) => {
    if (current.length === k) {
      result.push(current.slice());
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      current.push(items[i]);
      walk(i + 1);
      current.pop();
    }
  };
  walk(0);
  return result;
}

/** All course selections that satisfy one requirement, best-scoring first. */
function requirementOptions(
  req: ReqDef,
  score: (courseId: string) => number,
  limit: number,
): string[][] {
  let opts: string[][] = [];

  if (req.type === "oneOf") {
    opts = req.from.map((id) => [id]);
  } else if (req.type === "all") {
    opts = [req.from.slice()];
  } else if (req.type === "nOf") {
    opts = combinations(req.from, req.n ?? 1);
  } else {
    const n = req.n ?? 3;
    const groupChoices = req.groups.map((g) => {
      const picks: { courses: string[]; size: number }[] = [];
      for (let size = 1; size <= Math.min(g.from.length, n); size += 1) {
        for (const combo of combinations(g.from, size)) {
          picks.push({ courses: combo, size });
        }
      }
      return picks;
    });

    // Cartesian product, keeping selections of exactly n distinct courses that
    // include at least one from every group.
    const walk = (index: number, chosen: string[]) => {
      if (index === groupChoices.length) {
        if (chosen.length === n) opts.push([...new Set(chosen)]);
        return;
      }
      for (const pick of groupChoices[index]) {
        const next = [...chosen, ...pick.courses];
        if (next.length > n) continue;
        walk(index + 1, next);
      }
    };
    walk(0, []);
    opts = opts.filter((o) => o.length === n);
  }

  const unique = new Map<string, string[]>();
  for (const o of opts) {
    const key = [...o].sort().join("|");
    if (!unique.has(key)) unique.set(key, o);
  }

  return [...unique.values()]
    .map((o) => ({
      o,
      s: o.reduce((acc, id) => acc + score(id), 0),
    }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.o);
}

interface Beam {
  chosen: string[];
  perRequirement: string[][];
  score: number;
  nonCs: number;
}

/**
 * Beam search over the specialization requirements. Requirements are small, so
 * keeping the best N partial selections per requirement is exact in practice
 * while staying fast for every specialization in the catalog. The 6-credit cap
 * on non-CS/CSE subjects is applied as a hard bound at every step.
 */
function solveRequirements(
  spec: SpecDef,
  score: (courseId: string) => number,
  beamWidth = 96,
): Beam | null {
  let beams: Beam[] = [{ chosen: [], perRequirement: [], score: 0, nonCs: 0 }];

  for (const req of spec.requirements) {
    const options = requirementOptions(req, score, 400);
    if (options.length === 0) return null;

    const next: Beam[] = [];
    for (const beam of beams) {
      const taken = new Set(beam.chosen);
      for (const option of options) {
        if (option.some((id) => taken.has(id))) continue;
        const addedNonCs = option.filter(countsTowardCap).length;
        const nonCs = beam.nonCs + addedNonCs;
        if (nonCs > MAX_NON_CS_COURSES) continue;
        next.push({
          chosen: [...beam.chosen, ...option],
          perRequirement: [...beam.perRequirement, option],
          score: beam.score + option.reduce((acc, id) => acc + score(id), 0),
          nonCs,
        });
      }
    }
    if (next.length === 0) return null;

    const deduped = new Map<string, Beam>();
    for (const beam of next) {
      const key = [...beam.chosen].sort().join("|");
      const existing = deduped.get(key);
      if (!existing || existing.score < beam.score) deduped.set(key, beam);
    }

    beams = [...deduped.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, beamWidth);
  }

  return beams[0] ?? null;
}

export function buildPlan(
  spec: SpecDef,
  catalog: Catalog,
  interests: Map<string, BucketId>,
): Plan | null {
  const scoreFor = (courseId: string) => weightOf(interests.get(courseId));

  const beam = solveRequirements(spec, scoreFor);
  if (!beam) return null;

  const requirementResults: RequirementResult[] = spec.requirements.map(
    (req, i) => ({
      id: req.id,
      label: req.label,
      satisfied: true,
      courses: beam.perRequirement[i],
    }),
  );

  const chosen = beam.chosen;
  const chosenSet = new Set(chosen);
  const flavour = new Set(spec.flavourTags);

  // Free electives must respect the same non-CS/CSE credit cap.
  const nonCsRanked = catalog.courses
    .filter((c) => !chosenSet.has(c.id))
    .map((c) => ({
      id: c.id,
      nonCs: countsTowardCap(c.id),
      rank:
        scoreFor(c.id) +
        c.tags.filter((t) => flavour.has(t)).length * 1.25 +
        (c.foundational ? 0.5 : 0),
    }))
    .sort((a, b) => b.rank - a.rank);

  const freeSlots = Math.max(0, DEGREE_COURSES - chosen.length);
  let nonCsUsed = chosen.filter(countsTowardCap).length;
  const free: string[] = [];
  for (const candidate of nonCsRanked) {
    if (free.length >= freeSlots) break;
    if (candidate.nonCs) {
      if (nonCsUsed >= MAX_NON_CS_COURSES) continue;
      nonCsUsed += 1;
    }
    free.push(candidate.id);
  }

  const requirementByCourse = new Map<string, string>();
  for (const req of requirementResults) {
    for (const id of req.courses) {
      if (!requirementByCourse.has(id)) requirementByCourse.set(id, req.id);
    }
  }

  const planCourses: PlanCourse[] = [...chosen, ...free].map((id) => {
    const course = catalog.byId.get(id)!;
    const bucket = interests.get(id) ?? null;
    const reqId = requirementByCourse.get(id) ?? null;
    return {
      id,
      title: course.title,
      subject: course.subject,
      number: course.number,
      foundational: course.foundational,
      bucket,
      weight: weightOf(bucket),
      role: reqId ? "specialization" : "free",
      requirement: reqId,
    };
  });

  const bucketsUsed = {
    high: planCourses.filter((c) => c.bucket === "high").length,
    medium: planCourses.filter((c) => c.bucket === "medium").length,
    low: planCourses.filter((c) => c.bucket === "low").length,
  } as Record<BucketId, number>;

  const interestIds = [...interests.keys()].filter((id) =>
    catalog.byId.has(id),
  );
  const maxInterestScore = interestIds.reduce(
    (acc, id) => acc + scoreFor(id),
    0,
  );
  const interestScore = planCourses
    .filter((c) => c.bucket !== null)
    .reduce((acc, c) => acc + c.weight, 0);

  // Best achievable score for any ten-course plan: take the heaviest ranked
  // courses first, then pad with unranked ones at their default weight. Fit is
  // measured against that ceiling rather than against the whole ranked catalog,
  // otherwise ranking 70 courses would make every plan look like a 13% match.
  const rankedWeights = interestIds
    .map((id) => scoreFor(id))
    .sort((a, b) => b - a);
  const ceiling =
    rankedWeights.slice(0, DEGREE_COURSES).reduce((a, b) => a + b, 0) +
    Math.max(0, DEGREE_COURSES - rankedWeights.length) * UNASSIGNED_WEIGHT;

  const totalCredits = planCourses.reduce(
    (acc, c) => acc + (catalog.byId.get(c.id)?.credits ?? 3),
    0,
  );

  return {
    specId: spec.id,
    specName: spec.name,
    specShort: spec.shortName,
    specUrl: spec.url,
    credits: spec.credits,
    courses: planCourses,
    requirements: requirementResults,
    interestScore,
    maxInterestScore,
    fit: ceiling > 0 ? Math.min(1, interestScore / ceiling) : 0,
    bucketsUsed,
    coverage: 0,
    freeCourses: free.length,
    foundationalCount: planCourses.filter((c) => c.foundational).length,
    totalCredits,
  };
}

export interface PlanSet {
  plans: Plan[];
  coverage: Record<string, number>;
  uncovered: string[];
  interestCount: number;
  totalCourseCount: number;
}

export function buildAllPlans(
  catalog: Catalog,
  interests: Map<string, BucketId>,
): PlanSet {
  const plans = catalog.specs
    .map((spec) => buildPlan(spec, catalog, interests))
    .filter((p): p is Plan => p !== null);

  const coverage: Record<string, number> = {};
  for (const id of interests.keys()) coverage[id] = 0;
  for (const plan of plans) {
    for (const course of plan.courses) {
      if (course.id in coverage) coverage[course.id] += 1;
    }
  }

  // Plans that carry more of the user's classes rank first; the specification
  // fit breaks ties so a 10/10 match beats a 3/3.
  plans.sort((a, b) => {
    if (b.fit !== a.fit) return b.fit - a.fit;
    if (b.bucketsUsed.high !== a.bucketsUsed.high) {
      return b.bucketsUsed.high - a.bucketsUsed.high;
    }
    if (b.interestScore !== a.interestScore) return b.interestScore - a.interestScore;
    return b.foundationalCount - a.foundationalCount;
  });

  return {
    plans: plans.map((p, i) => ({
      ...p,
      coverage: p.courses.filter((c) => coverage[c.id] >= 1).length,
      rank: i + 1,
    })) as Plan[],
    coverage,
    uncovered: Object.keys(coverage).filter((id) => coverage[id] === 0),
    interestCount: interests.size,
    totalCourseCount: catalog.courses.length,
  };
}

export interface Validation {
  ok: boolean;
  errors: string[];
}

/** Re-check a plan against the rules, independent of how it was produced. */
export function validatePlan(plan: Plan, spec: SpecDef, catalog: Catalog): Validation {
  const errors: string[] = [];
  const ids = plan.courses.map((c) => c.id);

  if (ids.length !== DEGREE_COURSES) {
    errors.push(`Expected ${DEGREE_COURSES} courses, found ${ids.length}.`);
  }
  if (new Set(ids).size !== ids.length) {
    errors.push("A course appears more than once.");
  }
  const credits = ids.reduce((acc, id) => acc + (catalog.byId.get(id)?.credits ?? 0), 0);
  if (credits !== 30) errors.push(`Expected 30 credits, found ${credits}.`);
  if (ids.some((id) => !catalog.byId.has(id))) errors.push("Unknown course in plan.");

  const nonCs = ids.filter(countsTowardCap);
  if (nonCs.length > MAX_NON_CS_COURSES) {
    errors.push(
      `${nonCs.length} non-CS/CSE courses exceeds the ${MAX_NON_CS_COURSES}-course (6 credit) cap.`,
    );
  }
  const foundational = ids.filter((id) => catalog.byId.get(id)?.foundational).length;
  if (foundational < 2) {
    errors.push(`Only ${foundational} foundational course(s); 2 are required.`);
  }

  const set = new Set(ids);
  for (const req of spec.requirements) {
    const inPlan = req.from.filter((id) => set.has(id));
    if (req.type === "oneOf" && inPlan.length < 1) {
      errors.push(`Unsatisfied: ${req.label}`);
    }
    if (req.type === "all" && req.from.some((id) => !set.has(id))) {
      errors.push(`Unsatisfied: ${req.label}`);
    }
    if (req.type === "nOf" && inPlan.length < (req.n ?? 1)) {
      errors.push(`Unsatisfied: ${req.label}`);
    }
    if (req.type === "nOfWithEach") {
      const total = new Set(req.from.filter((id) => set.has(id))).size;
      const groupsOk = req.groups.every((g) => g.from.some((id) => set.has(id)));
      if (total < (req.n ?? 1) || !groupsOk) errors.push(`Unsatisfied: ${req.label}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
