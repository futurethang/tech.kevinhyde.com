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

## Status

Under active construction — see `PROGRESS.md` for current phase and `DECISIONS.md`
for the ADR log. Run/deploy notes (Fly.io launch, backups, the Turso escape hatch)
are filled in as later phases land.

<!-- TODO(phase-6): full setup checklist (§7), deploy runbook, backup/restore,
     Turso-migration escape hatch. -->
