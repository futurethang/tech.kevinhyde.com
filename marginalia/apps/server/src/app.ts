import { Hono } from 'hono';
import { bearerAuth } from './auth.ts';
import type { AppDeps } from './deps.ts';
import { itemsRoute } from './routes/items.ts';
import { notesRoute } from './routes/notes.ts';
import { sourcesRoute } from './routes/sources.ts';
import { ingestRoute } from './routes/ingest.ts';

export interface CreateAppOptions extends AppDeps {
  appToken: string;
}

/**
 * Build the Hono API (§3.7). Everything under /api is bearer-authed except
 * /api/healthz (the middleware exempts it). Static PWA hosting is added in Phase 4.
 */
export function createApp(opts: CreateAppOptions): Hono {
  const app = new Hono();
  const api = new Hono();

  // Auth first; bearerAuth() internally lets /api/healthz through.
  api.use('*', bearerAuth(opts.appToken));

  api.get('/healthz', (c) => c.json({ status: 'ok' }));
  api.route('/items', itemsRoute(opts));
  api.route('/notes', notesRoute(opts));
  api.route('/sources', sourcesRoute(opts));
  api.route('/ingest', ingestRoute(opts));

  app.route('/api', api);

  // Placeholder root until the PWA is served here (Phase 4).
  app.get('/', (c) => c.text('Marginalia API. PWA served here in Phase 4.'));

  return app;
}
