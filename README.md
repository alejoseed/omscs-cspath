# OMSCS Path Builder

Sort Georgia Tech's OMSCS course catalog into three interest buckets, then get a ranked set of
ten-course degree plans — one per specialization — with DeepSeek explaining the trade-offs.

## What it does

1. **All 78 courses** in the OMSCS catalog (the CS/CSE courses plus the OMS-Analytics and
   OMS-Cybersecurity courses open to OMSCS students) live in a local SQLite database, along with
   foundational flags, department, and description/tag metadata.
2. **Three interest buckets** — *Highly*, *Moderately*, *Barely interested*. Drag courses in, or
   use the H / M / B buttons on any row. Every assignment is written to SQLite immediately, so the
   board survives a reload.
3. **Create path** builds a legal plan for **every one of the six specializations**. Each plan is
   exactly 10 courses / 30 credits, satisfies that specialization's published requirement groups,
   includes at least two foundational courses, and respects the 6-credit cap on non-CS/CSE subjects.
4. **DeepSeek ranks the plans.** The solver hands over six already-legal plans; DeepSeek orders them
   for you and writes a rationale plus workload warnings. Without a key, you still get a complete
   solver-ranked result set with rule-based commentary.

## The six specializations and their rules

| Specialization | Specialization credits | Requirement shape (online-offered courses only) |
| --- | --- | --- |
| Artificial Intelligence | 15 | 1 of {CS 6300, CS 6515} + 2 of 6 AI core + 2 more |
| Computational Perception & Robotics | 15 | CS 6515 + 1 of {CS 6601, CS 7641} + 3 electives, ≥1 perception and ≥1 robotics |
| Computer Graphics | 15 | 1 of {CS 6457, CS 6491, CS 7496} + CS 6515 + 3 of 5 graphics courses |
| Computing Systems | 18 | CS 6515 + 2 of 5 systems core + 3 systems electives |
| Human-Computer Interaction | 15 | CS 6750 + CS 7470 + 3 electives, ≥1 design and ≥1 interactive technology |
| Machine Learning | 15 | CS 6515 + CS 7641 + 3 ML electives |

Rules are transcribed from the OMSCS specialization pages and stored as data
(`requirements`, `requirement_groups`, `requirement_courses`), not as code — the solver reads them
from SQLite, so fixing a rule means editing one row.

## Running it

```bash
npm install
cp .env.example .env.local   # add DEEPSEEK_API_KEY (optional but recommended)
npm run dev                  # http://localhost:4311
```

The database is created and seeded automatically on first request under `data/omscs.db`. Useful
scripts:

```bash
npm run db:seed      # re-seed the catalog (keeps your saved interests)
npm run db:reset     # delete the database; next start recreates it
npm run verify       # prove every generated plan is legal, and exercise DeepSeek handling
npm run typecheck
npm run lint
```

## DeepSeek

DeepSeek is the only LLM provider in this app. It is called over its OpenAI-compatible
`/chat/completions` endpoint, so there is no SDK dependency.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | — | Required for LLM ranking. Without it the app runs solver-only. |
| `DEEPSEEK_MODEL` | `deepseek-chat` | Model name sent to the API. |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | Override for a proxy or gateway. |

The model only ever **reorders and explains** plans the solver already produced. It never invents
courses, and every plan is re-validated server-side before it is returned. If the call fails, times
out, or returns unparseable JSON, the response falls back to the deterministic solver ranking and
surfaces the error in the UI rather than failing the request.

## Architecture

```
src/data/courses.ts          78-course catalog (source of truth for seeding)
src/data/specializations.ts  six specializations + requirement groups + bucket weights
src/lib/db.ts                SQLite schema, migrations, idempotent seeding
src/lib/planner.ts           catalog loading, beam-search solver, plan validation
src/lib/llm.ts               DeepSeek call, prompt, response parsing, solver fallback
src/app/api/catalog         GET  courses, specializations, saved interests
src/app/api/interests       PUT  assign/unassign a course; DELETE clear all
src/app/api/plan            POST solve every specialization + rank with DeepSeek
src/app/api/health          GET  row counts
```

### How the solver works

For each specialization it runs a beam search over that specialization's requirement groups,
scoring each candidate course by its bucket weight (Highly 10, Moderately 5, Barely 2, unranked 0.5).
The 6-credit non-CS/CSE cap is enforced as a hard bound at every step of the search. The remaining
slots are filled from the user's highest-weighted courses first, subject to the same cap.

Each finished plan is then handed to `validatePlan()`, which independently re-checks course count,
credit total, duplicates, requirement satisfaction, foundational coverage, and the subject cap, and
returns explicit errors instead of a plan. `npm run verify` runs this over seven different interest
distributions, including an all-78-courses-ranked case and a deliberately hostile one.

## Notes

- The 78 courses include every course on the OMSCS Current Courses page. Seminars (1 credit,
  pass/fail) are excluded because they do not count toward graduation.
- Requirement data reflects the published OMSCS pages at build time; a few listed courses are
  on-campus only and are therefore excluded from the online pools.
- This is a planning toy, not official Georgia Tech advising.
