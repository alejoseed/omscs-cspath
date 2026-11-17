# Cloudflare deployment

The app targets Cloudflare Workers via the OpenNext adapter, with **D1** as the only database.
`better-sqlite3` is a native module and cannot run on Workers, so the data layer was moved to D1's
async API — the schema and all queries are plain SQL, so nothing else changed.

## First-time setup

```bash
npm install

# 1. Sign in to Cloudflare
npx wrangler login

# 2. Create the D1 database, then copy the printed database_id
npm run db:create

# 3. Paste that id into wrangler.jsonc -> d1_databases[0].database_id
#    (replacing REPLACE_WITH_YOUR_DATABASE_ID)

# 4. Load the schema and the catalog
npm run db:migrate:remote

# 5. Give the Worker your DeepSeek key
npx wrangler secret put DEEPSEEK_API_KEY

# 6. Ship it
npm run deploy
```

`npm run deploy` builds with OpenNext and publishes the Worker. The `routes` block in
`wrangler.jsonc` already claims `cspath.alejoseed.com` as a custom domain, so Cloudflare creates the
DNS record and certificate on the first deploy — provided `alejoseed.com` is an active zone in the
same account.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run db:create` | Create the D1 database |
| `npm run db:seed` | Regenerate `migrations/0002_seed.sql` from `src/data` |
| `npm run db:migrate` | Apply migrations to the **local** D1 emulator |
| `npm run db:migrate:remote` | Apply migrations to the **real** D1 database |
| `npm run preview` | Build and run the Worker locally against local D1 |
| `npm run deploy` | Build and deploy to Cloudflare |
| `npm run cf-typegen` | Regenerate `CloudflareEnv` binding types |
| `npm run verify` | Prove every generated plan is legal + exercise DeepSeek handling |

## How the data layer works

- `migrations/0001_init.sql` — schema only.
- `migrations/0002_seed.sql` — **generated** from `src/data/courses.ts` and
  `src/data/specializations.ts` by `npm run db:seed`. Never edit it by hand. Every statement is
  idempotent, so re-applying is safe.
- `src/lib/d1.ts` — resolves the `DB` binding through `getCloudflareContext()`.
- `src/lib/planner.ts` — `loadCatalog()` / `loadInterests()` are now `async`; everything downstream
  (solver, validation, ranking) is pure and unchanged.

## Things worth knowing for a rewrite

The parts worth carrying over to another framework are all plain SQL and pure functions:

- **Schema**: `migrations/0001_init.sql`, eight tables. `courses`, `specializations`,
  `requirements`, `requirement_groups`, `requirement_courses`, `buckets`, `course_interests`
  (starter palette), `rate_limits`.
- **Seed data**: `migrations/0002_seed.sql`, or regenerate from `src/data/*.ts`.
- **Solver**: `src/lib/planner.ts` — `buildPlan`, `buildAllPlans`, `validatePlan`,
  `sanitizeInterests`, `weightOf`. No I/O, no framework imports.
- **Catalog types**: `src/lib/types.ts` and the `Catalog` / `SpecDef` / `ReqDef` shapes in
  `planner.ts`.
- **LLM layer**: `src/lib/llm.ts` — DeepSeek over its OpenAI-compatible endpoint, with a
  deterministic solver fallback. Framework-agnostic except for reading `process.env`.

Only the three files below are Next-specific: `src/app/**` (routes and pages),
`src/lib/catalog-server.ts` (server-side payload loader), and the `getCloudflareContext` call in
`src/lib/d1.ts`. In another framework, swap those for its equivalent of a request handler and read
the D1 binding from that runtime's `env`.
