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
