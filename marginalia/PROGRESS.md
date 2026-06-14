# PROGRESS

> Durable memory for the implementing agent (§0). Read this first every session,
> alongside `DECISIONS.md` and `git log --oneline -20`.

## RESUME HERE

Phase 0 is DONE and verified. The project lives at repo-root `marginalia/` as a
self-contained nested pnpm monorepo isolated from the parent `tech.kevinhyde.com`
workspace (ADR-002). Run all commands from inside `marginalia/`. Next up is
Phase 1 (data layer): Drizzle schema per §3.3, the first reviewed `.sql` migration,
the libSQL db client with migrate-on-start, and the drizzle-zod DTOs. No human
checkpoint until Phase 2 (real feed URLs).

## DONE

- **Phase 0 — scaffolding & config contract** (verified 2026-06-14):
  - pnpm workspace at `marginalia/` (root `package.json`, `pnpm-workspace.yaml`,
    strict `tsconfig.base.json`); `packages/core`, `apps/server`, `apps/web` created.
  - `.gitignore` (node_modules, data/, .env, web/dist).
  - `config/sources.yaml` with 2 REPLACE_ME placeholder entries (1 youtube, 1 podcast).
  - `packages/core/src/sources-config.ts`: `loadSourcesConfig()` — YAML parse +
    Zod validation (slug regex, type enum, url, cross-field exclude_shorts/podcast
    rule, duplicate-slug detection) + poll-interval normalization. Throws readable
    `SourcesConfigError`.
  - `PROGRESS.md`, `DECISIONS.md` (ADR-001 stack, ADR-002 placement), `README.md`.
  - Verify: `pnpm i` ✓; `pnpm typecheck` ✓ (all 3 pkgs); `pnpm check:config` loads &
    normalizes the good file ✓; broken YAML prints clear per-field + cross-field +
    duplicate-slug errors ✓.

## NOW

- Phase 0 complete. Ready to start Phase 1.

## NEXT

1. Phase 1 — install `drizzle-orm`, `@libsql/client`, `drizzle-kit`, `drizzle-zod`,
   `ulid` (pin latest stable; follow current Drizzle libSQL docs).
2. `packages/core/src/{schema,ids,db,zod}.ts` per §3.3; `drizzle.config.ts`.
3. `drizzle-kit generate` → READ the emitted `.sql` and confirm it matches intent
   before committing; apply to a fresh `data/app.db`.
4. Verify: tables + `(source_id, external_id)` unique index exist; round-trip a fake
   source+item+state+note+summary via a throwaway script.
