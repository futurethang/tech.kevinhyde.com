import { Hono } from 'hono';
import type { AppDeps } from '../deps.ts';
import { runIngest } from '../ingest/run.ts';

/** Manual "refresh now" trigger (§3.7): POST /api/ingest/run. */
export function ingestRoute(deps: AppDeps): Hono {
  const { db } = deps;
  const app = new Hono();

  app.post('/run', async (c) => {
    // force=true: poll every active source regardless of its interval.
    const result = await runIngest(db, { force: true });
    return c.json(result);
  });

  return app;
}
