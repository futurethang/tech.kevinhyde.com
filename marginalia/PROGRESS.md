# PROGRESS

> Durable memory for the implementing agent (§0). Read this first every session,
> alongside `DECISIONS.md` and `git log --oneline -20`.

## RESUME HERE

Phases 0–1 are DONE+verified. Phase 2 (ingestion/cron) CODE is complete and
offline-verified; it is **paused at the first 🧑‍🔧 human checkpoint** awaiting real
feed URLs to replace the REPLACE_ME entries in `config/sources.yaml` (1 real YouTube
channel feed + 1 real podcast feed, see README/§7.3). Once the owner provides them,
run the LIVE Phase 2 Verify: `pnpm tsx apps/server/src/dev-ingest.ts` twice (2nd run
inserts 0 = dedup), then typo one feed_url and confirm the other still ingests while
the broken source records last_status='error'; inspect a stored feed_item.raw_json.
Then commit and proceed to Phase 3 (API layer).

Project lives at repo-root `marginalia/` (nested pnpm monorepo, ADR-002); run all
commands from inside `marginalia/`.

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

## DONE (cont.)

- **Phase 2 — ingestion/cron** CODE (offline-verified 2026-06-14; live verify pending):
  - Deps: rss-parser 3.13, node-cron 4.2, p-limit 7.3, drizzle-orm (server).
  - `apps/server/src/ingest/`: normalize.ts (FeedItemDraft + safe helpers);
    parse-youtube.ts (Atom + yt:/media:, exclude_shorts UC→UULF transform, thumbnail
    from videoId); parse-podcast.ts (RSS + content:encoded + itunes:, feed-image
    fallback); sync.ts (syncSources: upsert by slug, seed tags+links, deactivate
    dropped); run.ts (runIngest: due filter, p-limit 4, onConflictDoNothing dedup,
    item_state 'new' + item_tag seed (D5) + 'ingested' event, per-source try/catch
    health); scheduler.ts (node-cron tick from smallest interval); dev-ingest.ts entry.
  - Offline verify (scripts/phase2-offline.ts): URL transform, YT + podcast mapping
    (externalId/url/description/thumbnail/rawJson), syncSources upsert/seed/idempotent/
    deactivate — all ✓. `pnpm typecheck` ✓.

## NOW

- 🧑‍🔧 PAUSED at human checkpoint: need 2 real feed URLs before the LIVE Phase 2 verify.

## NEXT

1. (after feeds provided) LIVE verify: dev-ingest twice (dedup), break one feed,
   inspect raw_json; commit; update DONE.
2. Phase 3 — API layer (§3.7): Hono + @hono/node-server + @hono/zod-validator;
   auth.ts bearer middleware; routes (items list/detail, state PATCH, tags, notes,
   sources, ingest/run, summary stub); boot wiring in index.ts.
