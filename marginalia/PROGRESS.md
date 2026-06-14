# PROGRESS

> Durable memory for the implementing agent (§0). Read this first every session,
> alongside `DECISIONS.md` and `git log --oneline -20`.

## RESUME HERE

Phases 0 and 1 are DONE and verified. The project lives at repo-root `marginalia/`
as a self-contained nested pnpm monorepo isolated from the parent `tech.kevinhyde.com`
workspace (ADR-002). Run all commands from inside `marginalia/`. The data layer is
complete: Drizzle schema (§3.3), reviewed migration `drizzle/0000_init.sql`, libSQL
client + migrate-on-start (`packages/core/src/db.ts`), and drizzle-zod schemas
(`zod.ts`). Next up is **Phase 2 (ingestion/cron)**: `syncSources()`, YouTube +
podcast parsers, `runIngest()` with dedup + per-source resilience. Phase 2 contains
the FIRST 🧑‍🔧 human checkpoint — real feed URLs in `config/sources.yaml` — so build
the pipeline, then STOP and ask for 1 real YouTube channel feed + 1 real podcast feed
before the live-data Verify step.

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

## DONE (cont.)

- **Phase 1 — data layer** (verified 2026-06-14):
  - Deps: drizzle-orm 0.45.2, @libsql/client 0.17.3, drizzle-kit 0.31.10,
    drizzle-zod 0.8.3, ulid 3.0.2 (API verified against installed packages, ADR-004).
  - `packages/core/src/{constants,ids,schema,db,zod}.ts` per §3.3 (D1–D5 realized,
    ADR-003). Timestamps = epoch ms integers throughout.
  - `drizzle.config.ts` (dialect 'turso' = libSQL escape hatch); reviewed migration
    `drizzle/0000_init.sql`.
  - `.env.example` written (§4 env contract).
  - Verify: `drizzle-kit generate` emitted SQL reviewed (ULID PKs, raw_json NOT NULL,
    unique (source_id, external_id), 1:1 item_state, append-only summary, TEXT status
    fields, cascade FKs) ✓; migrations apply to fresh DB ✓; round-tripped
    source+tag+source_tag+feed_item+item_state+note+summary ✓; dedup index rejected a
    duplicate ✓; append-only summary produced 2 rows ✓; `pnpm typecheck` ✓.

## NOW

- Phase 1 complete. Ready to start Phase 2 (ingestion/cron).

## NEXT

1. Phase 2 — install `rss-parser`, `node-cron`, `p-limit`.
2. `apps/server/src/ingest/{sync,parse-youtube,parse-podcast,normalize,run}.ts`:
   `syncSources()` (YAML → upsert source by slug, seed tag+source_tag); YouTube parser
   (Atom + yt:/media:, honor exclude_shorts via UC→UULF playlist trick, §7.3); podcast
   parser; `runIngest()` (due sources → fetch/parse, concurrency-limited → upsert on
   (source_id, external_id) → create item_state 'new' + seed item_tag per D5 →
   per-source try/catch health). Standalone tsx cron entry for now.
3. 🧑‍🔧 STOP before live-data Verify: ask owner for 1 real YouTube channel feed + 1
   real podcast feed to replace the REPLACE_ME entries (§7.3).
4. Verify: run ingest twice (2nd inserts 0 = dedup); break one feed URL and confirm
   the other still ingests + broken source shows last_status='error'; inspect a
   stored feed_item.raw_json.
