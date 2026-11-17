import type { Plan } from "@/lib/planner";

/**
 * DeepSeek is the only LLM provider this app talks to. It exposes an
 * OpenAI-compatible /chat/completions endpoint, so no SDK is needed.
 * https://api-docs.deepseek.com
 */
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

export interface RankedPlan {
  specId: string;
  rank: number;
  headline: string;
  rationale: string;
  watchOuts: string[];
}

export interface Narrative {
  engine: "deepseek" | "solver";
  summary: string;
  ranked: RankedPlan[];
  model: string | null;
  error?: string;
}

const SYSTEM_PROMPT = `You are an academic advisor for Georgia Tech's Online MS in Computer Science (OMSCS).

You receive candidate degree plans. Every plan has ALREADY been verified by a constraint solver: it contains exactly 10 courses, 30 credits, satisfies the official requirements for its specialization, includes at least two foundational courses, and respects the 6-credit cap on non-CS/CSE subjects. Do not invent courses, do not remove courses, and do not claim a plan is invalid on technical grounds.

Your job is to rank the plans for this specific student and explain the trade-offs in plain, concrete language. Weight (a) how many of the student's highly-interested courses appear, (b) how well the specialization's subject matter matches what they marked as interesting, (c) workload realism, and (d) career usefulness.

Respond with JSON only, matching exactly this shape:
{
  "summary": "2-3 sentence overview of the recommendation",
  "ranked": [
    {
      "specId": "<must be one of the provided specIds>",
      "rank": 1,
      "headline": "Under 70 characters, specific to this student",
      "rationale": "3-5 sentences. Name actual course numbers and why they fit.",
      "watchOuts": ["1-3 short, concrete warnings, e.g. heavy math load in CS 7641 + CS 7643"]
    }
  ]
}

Return every specId you were given, each exactly once, ranked 1..N with no ties.`;

function buildUserPrompt(plans: Plan[], interests: Record<string, string>): string {
  const lines = plans.map((p) => {
    const courses = p.courses
      .map((c) => `${c.id} (${c.bucket ?? "unranked"}, ${c.role})`)
      .join(", ");
    return `- specId: ${p.specId} | ${p.specName} (${p.credits} cr specialization)
  interest match: ${Math.round(p.fit * 100)}% of the best possible match
  courses: ${courses}`;
  });

  const bucket = (id: string) =>
    Object.entries(interests)
      .filter(([, b]) => b === id)
      .map(([courseId]) => courseId);

  return [
    `Student's interest buckets:`,
    `- Highly interested: ${bucket("high").join(", ") || "(none)"}`,
    `- Moderately interested: ${bucket("medium").join(", ") || "(none)"}`,
    `- Barely interested: ${bucket("low").join(", ") || "(none)"}`,
    "",
    "Candidate plans:",
    ...lines,
  ].join("\n");
}

function parseNarrative(raw: string, plans: Plan[]): RankedPlan[] | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const ranked = (parsed as { ranked?: unknown }).ranked;
  if (!Array.isArray(ranked)) return null;

  const valid = new Set(plans.map((p) => p.specId));
  const seen = new Set<string>();
  const out: RankedPlan[] = [];
  for (const item of ranked) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const specId = String(entry.specId ?? "");
    if (!valid.has(specId) || seen.has(specId)) continue;
    seen.add(specId);
    out.push({
      specId,
      rank: out.length + 1,
      headline: String(entry.headline ?? "").slice(0, 140),
      rationale: String(entry.rationale ?? ""),
      watchOuts: Array.isArray(entry.watchOuts)
        ? entry.watchOuts.map((w) => String(w)).slice(0, 3)
        : [],
    });
  }
  return out.length ? out : null;
}

interface DeepSeekResponse {
  choices?: { message?: { content?: string } }[];
}

async function callDeepSeek(system: string, user: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set.");

  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${detail.slice(0, 240)}`);
  }

  const json = (await res.json()) as DeepSeekResponse;
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek returned an empty completion.");
  return content;
}

export function deepseekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

/** Deterministic ranking used when no key is set or the call fails. */
export function solverNarrative(plans: Plan[], totalRanked: number): Narrative {
  const ranked: RankedPlan[] = plans.map((p, i) => {
    const high = p.courses.filter((c) => c.bucket === "high");
    const matched = p.courses.filter((c) => c.bucket !== null);
    const topSpecCourses = p.courses
      .filter((c) => c.role === "specialization")
      .slice(0, 3)
      .map((c) => c.id);

    const rationale = [
      `This path puts ${matched.length} of your ${totalRanked} ranked courses into the degree, ${high.length} of them from your highly-interested bucket.`,
      `The specialization requirements are met with ${topSpecCourses.join(", ")} and the remaining ${p.freeCourses} slots are filled with the courses you weighted highest.`,
      p.fit >= 0.75
        ? `That is one of the strongest matches available for how you sorted the catalog.`
        : `It leaves some of your top picks outside the plan, which is expected for a ${p.credits}-credit specialization.`,
    ].join(" ");

    const watchOuts: string[] = [];
    if (
      p.courses.some((c) => c.id === "CS-7641") &&
      p.courses.some((c) => c.id === "CS-7643")
    ) {
      watchOuts.push("CS 7641 and CS 7643 together is a heavy maths and project load.");
    }
    if (p.foundationalCount < 2) {
      watchOuts.push(
        "Only one foundational course — you need 2 with a B or better in your first 12 months.",
      );
    }
    if (p.courses.some((c) => c.id === "CS-6515")) {
      watchOuts.push(
        "CS 6515 (Graduate Algorithms) is a known gatekeeper — schedule it with a light term.",
      );
    }

    return {
      specId: p.specId,
      rank: i + 1,
      headline:
        i === 0
          ? `Best fit: ${Math.round(p.fit * 100)}% of your weighted interests`
          : `${p.specName} keeps ${p.coverage || matched.length} of your picks in play`,
      rationale,
      watchOuts: watchOuts.slice(0, 2),
    };
  });

  const best = plans[0];
  return {
    engine: "solver",
    model: null,
    summary: best
      ? `${best.specName} ranks first, covering ${matched(best)} of your ${totalRanked} ranked courses with a ${Math.round(
          best.fit * 100,
        )}% weighted-interest match. Add a DEEPSEEK_API_KEY to get advisor-style commentary instead of this rule-based summary.`
      : "No plans could be built from the current buckets.",
    ranked,
  };
}

function matched(plan: Plan): number {
  return plan.courses.filter((c) => c.bucket !== null).length;
}

export async function rankPlans(
  plans: Plan[],
  interests: Record<string, string>,
): Promise<Narrative> {
  const totalRanked = Object.keys(interests).length;
  if (plans.length === 0) return solverNarrative(plans, totalRanked);
  if (!deepseekConfigured()) return solverNarrative(plans, totalRanked);

  try {
    const raw = await callDeepSeek(
      SYSTEM_PROMPT,
      buildUserPrompt(plans, interests),
    );
    const ranked = parseNarrative(raw, plans);
    if (!ranked) throw new Error("DeepSeek returned a ranking that could not be parsed.");

    // Any plan the model skipped keeps a solver-derived entry at the end.
    for (const p of plans.filter((x) => !ranked.some((r) => r.specId === x.specId))) {
      ranked.push({
        specId: p.specId,
        rank: ranked.length + 1,
        headline: `${p.specName} — solver-ranked fallback`,
        rationale: `Ranked by the constraint solver: ${matched(p)} of your ranked courses, ${Math.round(
          p.fit * 100,
        )}% weighted-interest match.`,
        watchOuts: [],
      });
    }

    const parsed = JSON.parse(
      raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1),
    ) as { summary?: string };

    return {
      engine: "deepseek",
      model: DEEPSEEK_MODEL,
      summary: String(parsed.summary ?? "").slice(0, 600),
      ranked,
    };
  } catch (error) {
    return {
      ...solverNarrative(plans, totalRanked),
      error: error instanceof Error ? error.message : "DeepSeek call failed.",
    };
  }
}
