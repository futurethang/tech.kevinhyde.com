import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { loadSourcesConfig, source } from '@marginalia/core';
import type { AppDeps } from '../deps.ts';
import { syncSources } from '../ingest/sync.ts';

/** Sources list + health, config re-sync, and runtime active-toggle (§3.7). */
export function sourcesRoute(deps: AppDeps): Hono {
  const { db, sourcesConfigPath } = deps;
  const app = new Hono();

  // GET /api/sources — list with runtime health.
  app.get('/', async (c) => {
    const rows = await db.query.source.findMany({
      orderBy: (s, { asc }) => asc(s.slug),
    });
    return c.json(rows);
  });

  // POST /api/sources/sync — re-read config/sources.yaml and upsert.
  app.post('/sync', async (c) => {
    const config = loadSourcesConfig(sourcesConfigPath);
    const result = await syncSources(db, config);
    return c.json(result);
  });

  // PATCH /api/sources/:id — runtime toggle of `active`.
  // NOTE: the next config sync re-asserts the YAML `active` value (precedence rule).
  app.patch(
    '/:id',
    zValidator('param', z.object({ id: z.string().min(1) })),
    zValidator('json', z.object({ active: z.boolean() })),
    async (c) => {
      const { id } = c.req.valid('param');
      const [updated] = await db
        .update(source)
        .set({ active: c.req.valid('json').active, updatedAt: Date.now() })
        .where(eq(source.id, id))
        .returning();
      if (!updated) return c.json({ error: 'not found' }, 404);
      return c.json(updated);
    },
  );

  return app;
}
