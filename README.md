# OMSCS Path Builder

Sort Georgia Tech's OMSCS course catalog into three interest buckets, then get a ranked set of
ten-course degree plans — one per specialization — with DeepSeek explaining the trade-offs.

## What it does

1. **All 78 courses** in the OMSCS catalog (the CS/CSE courses plus the OMS-Analytics and
   OMS-Cybersecurity courses open to OMSCS students) live in a **Cloudflare D1** database, along
   with foundational flags, department, and description/tag metadata.
2. **Three interest buckets** — *Highly*, *Moderately*, *Barely interested*. Drag courses in, or
   use the H / M / B buttons on any row. Buckets are saved in your browser, so they survive a
   reload and never collide with another visitor's choices.
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
from D1, so fixing a rule means editing one row.

## Running it

```bash
pnpm install
pnpm wrangler login
pnpm db:create            # then paste the id into wrangler.jsonc
pnpm db:migrate:remote    # schema + catalog
pnpm wrangler secret put DEEPSEEK_API_KEY
pnpm run deploy         # `pnpm deploy` is a pnpm built-in, so use `run`
```

There is no local database file any more: the app reads D1 through the `DB` binding, both locally
and in production. `pnpm dev` runs the server inside workerd via the Cloudflare Vite plugin, so dev
uses the same local D1 as `pnpm preview` (run `pnpm db:migrate` once first). For a local DeepSeek
key, put `DEEPSEEK_API_KEY=...` in `.dev.vars` (gitignored). Full setup and troubleshooting live in
[README-CLOUDFLARE.md](./README-CLOUDFLARE.md). Useful scripts:

```bash
pnpm db:seed      # regenerate migrations/0002_seed.sql from src/data
pnpm db:migrate   # apply migrations to the local D1 emulator
pnpm preview      # run the Worker locally against local D1
pnpm verify       # prove every generated plan is legal, and exercise DeepSeek handling
pnpm typecheck
pnpm lint
```

## DeepSeek

DeepSeek is the only LLM provider in this app. It is called over its OpenAI-compatible
`/chat/completions` endpoint, so there is no SDK dependency.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | — | Required for LLM ranking. Without it the app runs solver-only. |
| `DEEPSEEK_MODEL` | `deepseek-chat` | Model name sent to the API. |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | Override for a proxy or gateway. |
| `PLAN_RATE_LIMIT` | `15` | Plan runs allowed per client per window. |
| `PLAN_RATE_WINDOW_MS` | `60000` | Length of that window in milliseconds. |

`DEEPSEEK_API_KEY` is a Worker secret (`pnpm wrangler secret put DEEPSEEK_API_KEY`), never a file in
the repo. The rate-limit counters live in D1 rather than process memory, because a Workers isolate
does not outlive a request.

The model only ever **reorders and explains** plans the solver already produced. It never invents
courses, and every plan is re-validated server-side before it is returned. If the call fails, times
out, or returns unparseable JSON, the response falls back to the deterministic solver ranking and
surfaces the error in the UI rather than failing the request.

`/api/plan` is rate limited (15 runs per minute per client by default) because each run spends
DeepSeek tokens. The counters are rows in D1, incremented atomically by the INSERT. All SQL uses
bound parameters. Both the DeepSeek call and the plan request have hard timeouts, so a stalled
upstream surfaces as a solver-ranked result rather than a hung request.

## Architecture

```
src/data/courses.ts            78-course catalog (source of truth for the seed)
src/data/specializations.ts    six specializations + requirement groups + bucket weights
src/data/catalog.ts            builds the Catalog from data; starter palette
migrations/0001_init.sql       D1 schema (8 tables)
migrations/0002_seed.sql       generated seed SQL
src/lib/d1.server.ts           resolves the D1 binding from cloudflare:workers env
src/lib/planner.ts             catalog loading, request sanitising, solver, validation
src/lib/llm.server.ts          DeepSeek call, prompt, response parsing, solver fallback
src/lib/rate-limit.server.ts   D1-backed fixed-window rate limiter
src/lib/plan.server.ts         solve + validate + rank, shared by the server fn and /api/plan
src/lib/catalog.functions.ts   getCatalog server fn + catalogQueryOptions (TanStack Query)
src/lib/plan.functions.ts      createPlan server fn, called from the UI via useMutation
src/lib/interest-store.ts      localStorage persistence for a visitor's buckets
src/router.tsx                 router factory, per-request QueryClient, SSR query hydration
src/routes/__root.tsx          document shell, head tags, devtools
src/routes/index.tsx           the board; loader prefetches the catalog during SSR
src/routes/api/catalog.ts      GET  courses, specializations, starter palette, DeepSeek status
src/routes/api/plan.ts         POST solve every specialization + rank with DeepSeek
src/routes/api/health.ts       GET  row counts
```

The app runs on [TanStack Start](https://tanstack.com/start), deployed to Cloudflare Workers.
Files ending in `.server.ts` are protected by Start's import protection, so D1 access and the
DeepSeek key can never be bundled into the client. The catalog is fetched once by the index route's loader during SSR and hydrated into
the TanStack Query cache, so the first HTML response is complete. Plan runs go through the
`createPlan` server function; the `/api/*` routes remain as a plain HTTP contract for scripts and
other clients, and share the same rate limiter and validation.

Buckets are personal, so they never go in the shared database: the catalog endpoint returns a
seeded starter palette, the browser stores the visitor's own assignments in `localStorage`, and
each plan run carries them in the request body. That body is validated against the catalog by
`sanitizeInterests()` — unknown course ids, unknown bucket names, and non-object payloads are
dropped instead of trusted — and the route takes no other input.

### How the solver works

For each specialization it runs a beam search over that specialization's requirement groups,
scoring each candidate course by its bucket weight (Highly 10, Moderately 5, Barely 2, unranked 0.5).
The 6-credit non-CS/CSE cap is enforced as a hard bound at every step of the search. The remaining
slots are filled from the user's highest-weighted courses first, subject to the same cap.

Each finished plan is then handed to `validatePlan()`, which independently re-checks course count,
credit total, duplicates, requirement satisfaction, foundational coverage, and the subject cap, and
returns explicit errors instead of a plan. `pnpm verify` runs this over seven different interest
distributions, including an all-78-courses-ranked case and a deliberately hostile one.

## Notes

- The 78 courses include every course on the OMSCS Current Courses page. Seminars (1 credit,
  pass/fail) are excluded because they do not count toward graduation.
- Requirement data reflects the published OMSCS pages at build time; a few listed courses are
  on-campus only and are therefore excluded from the online pools.
- This is a planning toy, not official Georgia Tech advising.
