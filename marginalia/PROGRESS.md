# PROGRESS

> Durable memory for the implementing agent (§0). Read this first every session,
> alongside `DECISIONS.md` and `git log --oneline -20`.

## RESUME HERE

Phases 0–1 DONE+verified. Phase 3 (API layer) DONE+verified. Phase 2 (ingestion)
code is complete + offline-verified but its **live** verify is still paused at the
🧑‍🔧 feed checkpoint — the environment's network-egress allowlist blocks YouTube/Apple
(even google.com → 403), so I can neither resolve the @handle/Apple-Podcasts links to
canonical feeds nor run a live fetch. UNBLOCK options given to owner: add
`www.youtube.com` + `itunes.apple.com` + the podcast's feed host to the egress
allowlist (then I resolve via the standard YouTube Atom feed + iTunes Lookup API and
run the live verify), or paste the resolved UC… channel id + RSS URL.

Next coding work: **Phase 4** (real Anthropic summarizer + Vite/Lit/vite-plugin-pwa
shell, static-served from the same Hono app). Phase 4 has a 🧑‍🔧 checkpoint for
`ANTHROPIC_API_KEY`. Project at repo-root `marginalia/` (ADR-002); run all commands
from inside `marginalia/`.

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

## DONE (cont.)

- **Phase 3 — API layer** (verified 2026-06-14):
  - Deps: hono 4.12, @hono/node-server 2.0, @hono/zod-validator 0.8, dotenv.
  - Drizzle relations added to schema.ts (relational query API; no migration impact).
  - auth.ts (bearer, exempts /api/healthz); llm/summarize.ts (Summarizer interface +
    stubSummarizer, PROMPT_VERSION='v1'); data/items.ts (listItems w/ filters+search+
    cursor, getItemDetail); routes/{items,notes,sources,ingest}.ts; app.ts; index.ts
    boot (migrate→sync→scheduler→serve) with dotenv + graceful shutdown.
  - Verify: scripts/phase3-api.ts — 28 checks via app.request() (auth 401/200,
    list/filter/search incl. note bodies, state+timestamps, tags create/slugify/delete,
    notes CRUD, summary generate/cache/regenerate append-only, sources list/sync,
    ingest resilient errors=2 no-crash, 404s) all ✓. Real HTTP boot smoke: healthz 200
    unauth, /api/items 401→200, root placeholder, scheduler armed ✓. `pnpm typecheck` ✓.

## NOW

- Phase 3 complete. Phase 2 LIVE verify still blocked on feeds/egress (see RESUME HERE).
  Ready to start Phase 4 (LLM + PWA shell).

## NEXT

1. Phase 4 — install @anthropic-ai/sdk; implement real summarize.ts (on-demand,
   append-only, cache-unless-regenerate) behind the existing Summarizer interface.
   🧑‍🔧 needs ANTHROPIC_API_KEY (§7.2) — STOP and ask before the live summary verify.
2. Phase 4 — scaffold apps/web (Vite + Lit + vite-plugin-pwa): manifest, Workbox
   runtime caching (NetworkFirst for GET /api/items*, never cache mutations), token
   gate (IndexedDB), API client; serve apps/web/dist from the Hono app at '/'.
3. (when feeds/egress available) finish Phase 2 live verify.
