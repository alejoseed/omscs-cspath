# Vendored anti-slop

Source: the `install-anti-slop` Claude Code skill (`~/.claude/skills/install-anti-slop/assets/anti-slop`),
copied with its `scripts/install.mjs` on 2026-11-17.

Upstream repository and commit: **unknown**. The skill directory is not a git checkout and records no
source revision, so the exact upstream snapshot cannot be identified. Compare against a fresh copy of
the skill's `assets/anti-slop` before updating.

## Installed

- `tools/oxlint/anti-slop/index.ts`, registered in `.oxlintrc.json` as the `anti-slop` JS plugin.
- `tools/oxlint/anti-slop/effect/`, copied but **not registered**: the project has no direct `effect`
  dependency.
- `vendor/eslint-stylistic/` keeps its own `LICENSE` and `UPSTREAM.md` (ESLint Stylistic commit
  `435c3ea0fd26a5fef9042c4b36b6e165fbbf8d08`).
- `@oxlint/plugins` pinned to `1.94.0`, matching `oxlint`.

## Local deviations

- `anti-slop/require-readable-spacing` is `off`: the project chose not to enforce blank-line padding.
- `tsconfig.json` enables `allowImportingTsExtensions` so the plugin's `.ts` imports type-check.

No plugin source files were modified.
