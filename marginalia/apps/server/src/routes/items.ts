import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  ITEM_STATUS_VALUES,
  feedItem,
  itemEvent,
  itemState,
  itemTag,
  note,
  summary,
  tag,
  newId,
} from '@marginalia/core';
import type { AppDeps } from '../deps.ts';
import { getItemDetail, listItems } from '../data/items.ts';
import { PROMPT_VERSION } from '../llm/summarize.ts';

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const idParam = z.object({ id: z.string().min(1) });

export function itemsRoute(deps: AppDeps): Hono {
  const { db, summarizer } = deps;
  const app = new Hono();

  // GET /api/items — filtered, text-searched, cursor-paginated list.
  app.get(
    '/',
    zValidator(
      'query',
      z.object({
        status: z.enum(ITEM_STATUS_VALUES).optional(),
        tag: z.string().optional(),
        source: z.string().optional(),
        q: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(30),
      }),
    ),
    async (c) => {
      const result = await listItems(db, c.req.valid('query'));
      return c.json(result);
    },
  );

  // GET /api/items/:id — full item incl. notes + summaries.
  app.get('/:id', zValidator('param', idParam), async (c) => {
    const detail = await getItemDetail(db, c.req.valid('param').id);
    if (!detail) return c.json({ error: 'not found' }, 404);
    return c.json(detail);
  });

  // PATCH /api/items/:id/state — set triage status, stamp the matching *_at.
  app.patch(
    '/:id/state',
    zValidator('param', idParam),
    zValidator('json', z.object({ status: z.enum(ITEM_STATUS_VALUES) })),
    async (c) => {
      const { id } = c.req.valid('param');
      const { status } = c.req.valid('json');
      const now = Date.now();

      const item = await db.query.feedItem.findFirst({ where: eq(feedItem.id, id) });
      if (!item) return c.json({ error: 'not found' }, 404);

      const stamp: Record<string, number> = {};
      if (status === 'queued') stamp.queuedAt = now;
      if (status === 'ignored') stamp.ignoredAt = now;
      if (status === 'saved') stamp.savedAt = now;

      await db
        .insert(itemState)
        .values({ itemId: id, status, ...stamp })
        .onConflictDoUpdate({
          target: itemState.itemId,
          set: { status, ...stamp, updatedAt: now },
        });

      await db.insert(itemEvent).values({ itemId: id, eventType: `state:${status}`, at: now });

      const updated = await db.query.itemState.findFirst({ where: eq(itemState.itemId, id) });
      return c.json(updated);
    },
  );

  // POST /api/items/:id/tags — apply a user tag (create the tag if missing).
  app.post(
    '/:id/tags',
    zValidator('param', idParam),
    zValidator(
      'json',
      z.object({ slug: z.string().min(1).optional(), label: z.string().min(1) }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const slug = slugify(body.slug ?? body.label);
      if (!slug) return c.json({ error: 'invalid tag slug' }, 400);

      const item = await db.query.feedItem.findFirst({ where: eq(feedItem.id, id) });
      if (!item) return c.json({ error: 'not found' }, 404);

      const [t] = await db
        .insert(tag)
        .values({ slug, label: body.label, kind: 'user_tag' })
        .onConflictDoUpdate({ target: tag.slug, set: { updatedAt: Date.now() } })
        .returning();

      await db.insert(itemTag).values({ itemId: id, tagId: t!.id }).onConflictDoNothing();
      return c.json({ slug: t!.slug, label: t!.label, kind: t!.kind }, 201);
    },
  );

  // DELETE /api/items/:id/tags/:tagSlug — remove a tag link.
  app.delete(
    '/:id/tags/:tagSlug',
    zValidator('param', z.object({ id: z.string().min(1), tagSlug: z.string().min(1) })),
    async (c) => {
      const { id, tagSlug } = c.req.valid('param');
      const t = await db.query.tag.findFirst({ where: eq(tag.slug, tagSlug) });
      if (!t) return c.json({ error: 'tag not found' }, 404);
      await db.delete(itemTag).where(and(eq(itemTag.itemId, id), eq(itemTag.tagId, t.id)));
      return c.body(null, 204);
    },
  );

  // GET /api/items/:id/notes — list notes (oldest first).
  app.get('/:id/notes', zValidator('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const notes = await db.query.note.findMany({
      where: eq(note.itemId, id),
      orderBy: (n, { asc }) => asc(n.createdAt),
    });
    return c.json(notes);
  });

  // POST /api/items/:id/notes — create a note (many per item allowed).
  app.post(
    '/:id/notes',
    zValidator('param', idParam),
    zValidator('json', z.object({ body: z.string().min(1) })),
    async (c) => {
      const { id } = c.req.valid('param');
      const item = await db.query.feedItem.findFirst({ where: eq(feedItem.id, id) });
      if (!item) return c.json({ error: 'not found' }, 404);
      const [n] = await db
        .insert(note)
        .values({ itemId: id, body: c.req.valid('json').body })
        .returning();
      return c.json(n, 201);
    },
  );

  // GET /api/items/:id/summary — latest cached summary, if any.
  app.get('/:id/summary', zValidator('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const latest = await db.query.summary.findFirst({
      where: eq(summary.itemId, id),
      orderBy: (s, { desc: d }) => d(s.generatedAt),
    });
    if (!latest) return c.json({ error: 'no summary yet' }, 404);
    return c.json(latest);
  });

  // POST /api/items/:id/summary — generate (cache unless ?regenerate=true).
  app.post(
    '/:id/summary',
    zValidator('param', idParam),
    zValidator('query', z.object({ regenerate: z.coerce.boolean().default(false) })),
    async (c) => {
      const { id } = c.req.valid('param');
      const { regenerate } = c.req.valid('query');

      const item = await db.query.feedItem.findFirst({ where: eq(feedItem.id, id) });
      if (!item) return c.json({ error: 'not found' }, 404);

      if (!regenerate) {
        const cached = await db.query.summary.findFirst({
          where: and(
            eq(summary.itemId, id),
            eq(summary.promptVersion, PROMPT_VERSION),
            eq(summary.inputKind, 'metadata'),
          ),
          orderBy: (s, { desc: d }) => d(s.generatedAt),
        });
        if (cached) return c.json({ ...cached, cached: true });
      }

      const result = await summarizer({ title: item.title, description: item.description });
      const [row] = await db
        .insert(summary)
        .values({
          id: newId(),
          itemId: id,
          model: result.model,
          promptVersion: result.promptVersion,
          inputKind: result.inputKind,
          body: result.body,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          generatedAt: Date.now(),
        })
        .returning();
      return c.json({ ...row, cached: false }, 201);
    },
  );

  return app;
}
