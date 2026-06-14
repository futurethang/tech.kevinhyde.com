import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { note } from '@marginalia/core';
import type { AppDeps } from '../deps.ts';

/** Notes CRUD by note id (§3.7): PATCH/DELETE /api/notes/:noteId. */
export function notesRoute(deps: AppDeps): Hono {
  const { db } = deps;
  const app = new Hono();
  const noteParam = z.object({ noteId: z.string().min(1) });

  app.patch(
    '/:noteId',
    zValidator('param', noteParam),
    zValidator('json', z.object({ body: z.string().min(1) })),
    async (c) => {
      const { noteId } = c.req.valid('param');
      const [updated] = await db
        .update(note)
        .set({ body: c.req.valid('json').body, updatedAt: Date.now() })
        .where(eq(note.id, noteId))
        .returning();
      if (!updated) return c.json({ error: 'not found' }, 404);
      return c.json(updated);
    },
  );

  app.delete('/:noteId', zValidator('param', noteParam), async (c) => {
    const { noteId } = c.req.valid('param');
    const deleted = await db.delete(note).where(eq(note.id, noteId)).returning();
    if (deleted.length === 0) return c.json({ error: 'not found' }, 404);
    return c.body(null, 204);
  });

  return app;
}
