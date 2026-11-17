import type { BUCKETS } from "@/data/specializations";

export type BucketId = "high" | "medium" | "low";

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

export interface SpecSummary {
  id: string;
  name: string;
  shortName: string;
  credits: number;
  blurb: string;
  url: string;
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
  rank: number;
  headline: string;
  rationale: string;
  watchOuts: string[];
}

export interface PlanResponse {
  engine: "deepseek" | "solver";
  model: string | null;
  /** True when DEEPSEEK_API_KEY is present, so the UI can prompt for a key. */
  deepseekConfigured: boolean;
  summary: string;
  warning: string | null;
  plans: Plan[];
  coverage: Record<string, number>;
  uncovered: string[];
  interestCount: number;
  totalCourseCount: number;
  createdAt: string;
}

export interface CatalogPayload {
  courses: Course[];
  specializations: SpecSummary[];
  buckets: typeof BUCKETS;
  starterInterests: Record<string, BucketId>;
  deepseekConfigured: boolean;
}
