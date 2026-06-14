// Standalone Phase 2 entry (§5): migrate → sync sources → run one ingest.
// Cron lives here for now (not yet inside the API server). Run from marginalia/:
//   pnpm tsx apps/server/src/dev-ingest.ts            # one-shot
//   pnpm tsx apps/server/src/dev-ingest.ts --watch    # keep the scheduler running
import { createDb, loadSourcesConfig, runMigrations } from '@marginalia/core';
import { syncSources } from './ingest/sync.ts';
import { runIngest } from './ingest/run.ts';
import { startScheduler } from './ingest/scheduler.ts';

const { db } = await createDb();
await runMigrations(db, './drizzle');

const config = loadSourcesConfig();
const sync = await syncSources(db, config);
console.log('[sync]', JSON.stringify(sync));

const result = await runIngest(db, { force: true });
console.log('[ingest]', JSON.stringify(result, null, 2));

if (process.argv.includes('--watch')) {
  startScheduler(db, config);
  console.log('[dev-ingest] scheduler running — Ctrl+C to stop');
} else {
  process.exit(0);
}
