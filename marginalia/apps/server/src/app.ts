import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { bearerAuth } from './auth.ts';
import type { AppDeps } from './deps.ts';
import { itemsRoute } from './routes/items.ts';
import { notesRoute } from './routes/notes.ts';
import { sourcesRoute } from './routes/sources.ts';
import { ingestRoute } from './routes/ingest.ts';

export interface CreateAppOptions extends AppDeps {
  appToken: string;
  /** Path to the built PWA (apps/web/dist). When set, served at '/'. */
  webDist?: string;
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

  // Serve the built PWA at '/' (one process, one URL). Registered after /api so
  // API routes win. Unknown non-API paths fall back to index.html (SPA routing).
  if (opts.webDist) {
    app.use('/*', serveStatic({ root: opts.webDist }));
    app.get('*', serveStatic({ path: `${opts.webDist}/index.html` }));
  } else {
    app.get('/', (c) => c.text('Marginalia API (web dist not configured).'));
  }

  return app;
}
