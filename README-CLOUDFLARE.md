# Cloudflare deployment

The app is a TanStack Start app on Cloudflare Workers, built with the official
`@cloudflare/vite-plugin`, with **D1** as the only database. The SSR environment runs inside
workerd in dev, preview and production alike, so all three read the same `DB` binding.

## First-time setup

```bash
pnpm install

# 1. Sign in to Cloudflare
pnpm wrangler login

# 2. Create the D1 database, then copy the printed database_id
pnpm db:create

# 3. Paste that id into wrangler.jsonc -> d1_databases[0].database_id
#    (replacing REPLACE_WITH_YOUR_DATABASE_ID)

# 4. Load the schema and the catalog
pnpm db:migrate:remote

# 5. Ship it
pnpm run deploy   # `pnpm deploy` is a pnpm built-in, so use `run`
```

`pnpm run deploy` runs `vite build` and publishes the Worker with `wrangler deploy`. The `routes` block in
`wrangler.jsonc` already claims `cspath.alejoseed.com` as a custom domain, so Cloudflare creates the
DNS record and certificate on the first deploy — provided `alejoseed.com` is an active zone in the
same account.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm db:create` | Create the D1 database |
| `pnpm db:seed` | Regenerate `migrations/0002_seed.sql` from `src/data` |
| `pnpm db:migrate` | Apply migrations to the **local** D1 emulator |
| `pnpm db:migrate:remote` | Apply migrations to the **real** D1 database |
| `pnpm dev` | Vite dev server inside workerd, against local D1 (port 4311) |
| `pnpm preview` | Build and run the Worker locally against local D1 |
| `pnpm run deploy` | Build and deploy to Cloudflare |
| `pnpm cf-typegen` | Regenerate `CloudflareEnv` binding types |
| `pnpm verify` | Prove every generated plan is legal + exercise DeepSeek handling |

## How the data layer works

- `migrations/0001_init.sql` — schema only.
- `migrations/0002_seed.sql` — **generated** from `src/data/courses.ts` and
  `src/data/specializations.ts` by `pnpm db:seed`. Never edit it by hand. Every statement is
  idempotent, so re-applying is safe.
- `src/lib/d1.server.ts` — reads the `DB` binding from `env` in `cloudflare:workers`.
- `src/lib/planner.ts` — `loadCatalog()` / `loadInterests()` are now `async`; everything downstream
  (solver, validation, ranking) is pure and unchanged.

## DeepSeek key

There is no DeepSeek secret to set. Visitors bring their own key in the app; it stays in their
browser and is sent only with their plan runs.
