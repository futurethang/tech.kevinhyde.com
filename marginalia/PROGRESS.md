# PROGRESS

> Durable memory for the implementing agent (§0). Read this first every session,
> alongside `DECISIONS.md` and `git log --oneline -20`.

## RESUME HERE

Phases 0–1, 3, 4, 5 DONE+verified (code/offline/HTTP). Two things still need a human:
(1) **Phase 2 live verify** — blocked on the egress allowlist: YouTube + Apple are
blocked (even google.com → 403), so I can't resolve the @handle / Apple-Podcasts
links or do a live fetch. Owner options: add `www.youtube.com` + `itunes.apple.com`
+ the podcast feed host to the egress allowlist (then I resolve via the standard
YouTube Atom feed + iTunes Lookup API and run it), or paste the UC… channel id + RSS
URL. (2) **Live LLM summary verify** — needs `ANTHROPIC_API_KEY` (api.anthropic.com
IS reachable here — probe returned 404 not 403 — so it'll work once keyed). The PWA
**offline-install** verify is a manual browser step.

Next coding work: **Phase 6** (Dockerfile + fly.toml + README deploy runbook). Then
deploy is a 🧑‍🔧 action (§7.5). Project at repo-root `marginalia/` (ADR-002); run all
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

## DONE (cont.)

- **Phase 4 — LLM summaries + PWA shell** (verified 2026-06-15, minus key/browser steps):
  - llm/summarize-anthropic.ts: real Summarizer via @anthropic-ai/sdk (claude-haiku-4-5,
    system prompt = terse recall voice, records model + token usage). index.ts uses it
    when ANTHROPIC_API_KEY set, else stub. (ADR-006)
  - apps/web: Vite 8 + Lit 3 + vite-plugin-pwa 1.3. Manifest, Workbox NetworkFirst on
    GET /api/items*, placeholder maskable icons (generate-icons.mjs), IndexedDB token
    store (idb.ts), api.ts client. Hono serves apps/web/dist at '/' (serve-static, SPA
    fallback). Verify: typecheck ✓, vite build ✓ (sw.js + manifest + precache), HTTP
    smoke ✓ (/, /manifest.webmanifest, /sw.js, icon, SPA fallback, /api 401).
- **Phase 5 — minimal triage UI** (built; manual e2e pending real data):
  - app-shell (token gate + routing) + auth-gate + views/{list,detail,sources}.ts, each
    a "SCAFFOLD UI — disposable" Lit component talking only to api.ts + DTOs. List
    filters/search + inline queue/ignore/save + deep-link out; detail = description,
    notes CRUD, summarize/regenerate, tags, Open↗; sources = health + Refresh now +
    Sync config. Typecheck + build ✓.

- **Phase 6 — deploy artifacts** (authored; in-container build blocked by Docker Hub
  rate-limit in this env, not a Dockerfile defect):
  - Dockerfile (node:22-slim, pnpm install --frozen-lockfile → build web → `tsx` boot;
    migrate-on-start; env defaults), .dockerignore, fly.toml (1 app, volume at /data,
    DATABASE_URL=file:/data/app.db, min_machines_running=1, /api/healthz check),
    README deploy/backup runbook + Turso escape hatch. Each Dockerfile step is verified
    locally (pnpm install, web build, tsx boot); `fly deploy` runs on Fly's builders.

## NOW

- All build phases (0–6) authored & verified to the extent possible without external
  network/secrets. Remaining work is human-gated (see NEXT / RESUME HERE).

## NEXT (all 🧑‍🔧)

1. Phase 2 live verify — needs feeds/egress (add YouTube+Apple+feed host to egress
   allowlist, or paste UC… id + RSS URL). Then dev-ingest twice (dedup), break a feed.
2. Live LLM summary verify — needs ANTHROPIC_API_KEY (host reachable here).
3. PWA offline-install verify — manual browser step.
4. Deploy (§7.5) — fly launch / volume / secrets (APP_TOKEN, ANTHROPIC_API_KEY) /
   fly deploy; confirm DB persists across `fly machine restart`.
