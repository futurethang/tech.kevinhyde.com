# Marginalia

A single-user personal tool that turns passive consumption of opinionated
engineering content (YouTube channels + podcasts) into **retained, searchable,
annotated reference material**.

Two cooperating parts:

- **Ingestion worker** — a scheduled in-process job that polls a config-driven
  list of RSS/Atom feeds, detects new items, normalizes them, and stores them
  with metadata and the **full raw payload** (so nothing is ever lost).
- **PWA dashboard** — a "what's new" triage surface (queue / ignore / save) with
  tagging, freeform notes, and an on-demand LLM summary per item. Clicking an item
  **deep-links out** to YouTube / the podcast — it never embeds playback.

The durable value is **recall, not feeds**: months later you can find what you read
— including your own notes and the generated summary — even if the original video or
episode is gone.

> **Note:** This project lives at the repo-root path `marginalia/` inside the
> `tech.kevinhyde.com` repo as a self-contained pnpm monorepo, isolated from the
> parent workspace (see `DECISIONS.md` → ADR-002). Run all commands from inside
> `marginalia/`.

## Stack

TypeScript (strict) on Node ≥20 · pnpm workspaces · SQLite via libSQL +
Drizzle ORM · Zod / drizzle-zod · Hono (API + static PWA host) · node-cron
(in-process scheduling) · rss-parser · `@anthropic-ai/sdk` (on-demand summaries) ·
Vite + Lit + vite-plugin-pwa · Fly.io (single app + persistent volume).

See `DECISIONS.md` → ADR-001 for the rationale and locked tradeoffs.

## Layout

```
marginalia/
├─ config/sources.yaml      # THE source list — pure data, edited by humans
├─ packages/core/           # shared schema / types / db / config (framework-free)
├─ apps/server/             # Hono API + static PWA host + node-cron (one process)
└─ apps/web/                # Vite + Lit PWA
```

## Develop

```bash
cd marginalia
pnpm install

pnpm typecheck         # strict typecheck across all packages
pnpm check:config      # validate config/sources.yaml
```

## Sources config

`config/sources.yaml` is the **declarative source of truth** for which feeds exist
and their metadata. Adding/removing/editing a feed never requires touching code —
edit the file and re-run source sync (`POST /api/sources/sync`, or restart).

**Precedence rule:** the YAML is truth for which sources exist and their `active`
flag; the DB `source` row holds runtime state (`last_polled_at`, `last_error`, …).
The API may toggle `active` at runtime, but the next YAML sync re-asserts the file.
Sources are upserted by the stable `slug` and never deleted (missing slugs are
deactivated, preserving history).

To add a YouTube channel you need its **channel ID** (`UC…`) — the `@handle` does
not work in the feed URL. See the setup checklist for how to find it.

## Environment & secrets

Copy `.env.example` → `.env` and fill it in (see the variable table in
`.env.example`). `.env` is gitignored; never commit real secrets.

- `APP_TOKEN` — required; the shared bearer token. Generate: `openssl rand -hex 32`.
  You enter this once in the PWA's access screen.
- `ANTHROPIC_API_KEY` — required only for real summaries (Phase 4). Without it, the
  server falls back to a stub summarizer and everything else works.
- `DATABASE_URL` — `file:./data/app.db` in dev; `file:/data/app.db` in prod (Fly volume).

## Run locally

```bash
cd marginalia
pnpm install
pnpm --filter @marginalia/web build          # build the PWA once
APP_TOKEN=$(openssl rand -hex 32) pnpm tsx apps/server/src/index.ts
# → http://localhost:8080  (enter the APP_TOKEN on the access screen)
```

For PWA hot-reload during UI work, run `pnpm --filter @marginalia/web dev`
alongside the server (Vite proxies `/api` to `:8080`).

Add feeds by editing `config/sources.yaml`, then **Sync config** + **Refresh now**
in the Sources view (or `POST /api/sources/sync` then `POST /api/ingest/run`).

## Deploy to Fly.io (§7.5)

One app, one process, one volume holding `app.db`. `min_machines_running = 1` keeps
the in-process cron alive (a few $/month — accepted tradeoff, ADR-001).

```bash
# 1. Install flyctl + sign in
fly auth login

# 2. From marginalia/: launch (accept the app, DECLINE auto-deploy for now)
fly launch

# 3. Create the volume that holds the database (pick your region)
fly volumes create marginalia_data --size 1 --region <region>
#    Confirm fly.toml mounts it at /data and DATABASE_URL=file:/data/app.db

# 4. Set secrets (never in git / fly.toml)
fly secrets set APP_TOKEN=<from openssl rand -hex 32> ANTHROPIC_API_KEY=<sk-ant-...>

# 5. Deploy + open
fly deploy
fly open      # enter your APP_TOKEN on the access screen
```

Migrations run automatically on container start. The Dockerfile builds the PWA and
runs the server (which serves both the API and the static PWA on `$PORT`).

## Backups & restore

Fly snapshots the volume **daily** automatically (v1 backup strategy). To grab the
DB manually:

```bash
fly ssh console                              # poke around /data
fly ssh sftp get /data/app.db ./backup-app.db   # copy it off the machine
```

To restore, copy a backup back to `/data/app.db` (stop the machine first) or
restore the volume from a Fly snapshot.

*Later hardening (not built):* Litestream for continuous replication, or move to
managed Turso (below).

## Escape hatch: file → managed Turso (zero code change)

All DB access goes through the libSQL driver (async), so moving off the local file
to managed, zero-ops Turso storage is a **config change, not a code change**:

1. Create a Turso database; get its libSQL URL + auth token.
2. Set `DATABASE_URL=libsql://<your-db>.turso.io` and
   `DATABASE_AUTH_TOKEN=<token>` (as Fly secrets).
3. Redeploy. `drizzle.config.ts` already uses dialect `turso`, so `drizzle-kit`
   tooling works against it too.

## Status

See `PROGRESS.md` for the current phase and `DECISIONS.md` (ADR-001…006) for the
decision log.
