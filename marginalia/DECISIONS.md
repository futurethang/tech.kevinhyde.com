# DECISIONS (ADR log)

Architecture Decision Records. Append-only. Newest last. Stub in §0.4 of the brief.

---

## ADR-001: Adopt the locked stack from the kickoff brief
Date: 2026-06-14
Status: accepted
Context: The kickoff brief (§2) prescribes a LOCKED stack chosen for low operational
overhead, TypeScript-everywhere, easy self-hosting, and resistance to abandonment
at the persistence/scheduling layer.
Decision: Use it as-is — TypeScript (strict) on Node ≥20; pnpm-workspace monorepo;
SQLite via libSQL (`@libsql/client`) with Drizzle ORM + drizzle-kit migrations;
Zod + drizzle-zod for shared types; Hono + `@hono/node-server` serving both the API
and the built PWA in one process; `rss-parser` for feeds; `node-cron` in-process for
scheduling; `@anthropic-ai/sdk` (Haiku-tier) for on-demand summaries; Vite + Lit +
vite-plugin-pwa for the PWA; Fly.io single app + persistent volume for hosting.
Accepted tradeoffs (do not re-debate): in-process cron requires `min_machines_running=1`;
libSQL is async (buys the Turso escape hatch); no transcripts in v1; single shared-secret
bearer auth. Pin latest stable of each dep and follow current official docs.
Consequences: One language and one deployable process. The libSQL URL is the escape
hatch to managed Turso with zero code change. Changing any locked choice requires a new
ADR + human sign-off.

---

## ADR-002: Place Marginalia at repo-root `marginalia/`, isolated from the parent workspace
Date: 2026-06-14
Status: accepted
Context: Marginalia is being built inside the existing `tech.kevinhyde.com` repo (per
the assigned branch), but that repo is already a pnpm workspace globbing `site`,
`apps/*`, `packages/*`, and deploys static apps to GitHub Pages. Marginalia is a
full-stack, always-on Fly.io app that is itself a pnpm monorepo (server + DB + cron +
PWA). Nesting it as a normal package inside the parent workspace would collide
(workspace-inside-workspace) and entangle two different deploy targets.
Decision: Create the project as a self-contained nested monorepo at the repo root path
`marginalia/`, with its own `pnpm-workspace.yaml` and `package.json`. The parent
workspace does not glob `marginalia/`, so the two are fully isolated. All Marginalia
commands run from inside `marginalia/`. (Decision confirmed with the owner.)
Consequences: Matches the brief's exact layout (§3.1). GitHub Pages build is untouched;
Marginalia deploys independently to Fly.io. Slight deviation from this repo's
"apps live in /apps/" convention, justified by the different deploy target and the
nested-workspace constraint.

---

## ADR-003: Data-model migration-safety choices (D1–D5) + timestamp convention
Date: 2026-06-14
Status: accepted
Context: §3.3 of the brief locks the *shape* of the schema and a set of decision
points (D1–D5) whose whole purpose is to keep later UI iteration and model changes
cheap and migration-free. It also requires picking one timestamp representation.
Decision:
- TIMESTAMP CONVENTION: epoch **milliseconds stored as integer** columns, consistent
  across every table (created_at/updated_at and the domain *_at columns). JS-native
  (Date.now()), sortable, readable enough in raw SQL. Chosen over ISO text.
- Every entity has a ULID text primary key (ids.ts → newId()); every table has
  created_at + updated_at (including the join tables source_tag/item_tag — strict
  compliance with "every table", even though joins are delete+recreate rather than
  updated in place).
- D1: feed_item.raw_json (TEXT NOT NULL) stores the full original feed entry.
- D2: summary rows are append-only — NO unique constraint on
  (item_id, model, prompt_version, input_kind), so regenerate adds a row. input_kind
  ('metadata'|'transcript') reserves the transcript seam with no future migration.
- D3: a single `tag` table with kind ('focus_area'|'user_tag').
- D4: item_state is its own table, 1:1 with feed_item (unique item_id), so
  re-ingesting never clobbers triage decisions.
- D5: SEED item_tag from a source's focus_areas at ingest = YES (recommended), with
  such tags marked removable. (Implemented in Phase 2 ingest; recorded here.)
- Status/type fields (type, status, kind, last_status, input_kind, event_type) are
  TEXT constrained at the TS layer via .$type<>() against documented *_VALUES consts —
  not integer enums. exclude_shorts/active are boolean flags stored as integer.
- item_event audit table IS included in v1 (cheap; its history is not backfillable).
Consequences: First migration drizzle/0000_init.sql reviewed and committed. Future
UI can surface any raw_json field, show summary history / regenerate, and split or
merge tag presentation — all with zero schema change.

---

## ADR-004: libSQL/Drizzle access patterns
Date: 2026-06-14
Status: accepted
Context: The libSQL driver and drizzle-kit config have version-specific syntax; the
brief forbids trusting that from memory.
Decision: Verified against the installed packages (drizzle-orm 0.45.2,
@libsql/client 0.17.3, drizzle-kit 0.31.10, drizzle-zod 0.8.3, zod 4.4.3):
- db.ts uses createClient() from @libsql/client + drizzle() from drizzle-orm/libsql;
  migrations applied programmatically via migrate() from drizzle-orm/libsql/migrator
  (runMigrations()). createDb() turns on `PRAGMA foreign_keys = ON` per connection
  (SQLite/libSQL default it off).
- drizzle.config.ts uses dialect 'turso' with dbCredentials { url, authToken? } — the
  same dialect serves a local `file:` DB now and a managed Turso URL later (the
  escape hatch), unchanged.
Consequences: All DB access is async/awaited (deliberate — buys the Turso hatch).

---

## ADR-005: API layer shape (Hono) — dependency injection, summary caching, pagination
Date: 2026-06-14
Status: accepted
Context: Phase 3 builds the §3.7 API. A few choices worth pinning.
Decision:
- Route factories take an injected AppDeps { db, sourcesConfigPath, summarizer }.
  The summarizer is an interface (Summarizer) so Phase 4 swaps the Phase-3
  stubSummarizer for the real Anthropic call with no route changes.
- Auth: a single bearerAuth middleware on /api/* that internally exempts
  /api/healthz (registered before routes so it always runs first).
- Summary caching: POST /api/items/:id/summary returns the latest existing row for
  (prompt_version, input_kind='metadata') unless ?regenerate=true, which always
  inserts a new append-only row (D2). Responses carry a `cached` boolean.
- List pagination: cursor = ULID id, ordered desc (newest first), `lt(id, cursor)`;
  filters (status/source/tag/q) are applied as subquery conditions so the base query
  stays a simple feed_item scan. Text search (q) spans title + description + note
  bodies + summary bodies. raw_json is never exposed over the API.
- Tags: POST creates a user_tag (kind='user_tag'), slugifying the label if no slug
  is given; the controlled focus_area vocabulary is seeded only via YAML sync.
Consequences: The whole UI (Phase 5) talks only to this API + the Zod DTOs and can
be rebuilt without touching data/ingestion/API. Static PWA hosting is layered onto
the same Hono app in Phase 4.
