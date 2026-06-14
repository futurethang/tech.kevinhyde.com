import pLimit from 'p-limit';
import { eq } from 'drizzle-orm';
import type { DB, SourceRow } from '@marginalia/core';
import { feedItem, itemEvent, itemState, itemTag, source, sourceTag } from '@marginalia/core';
import { fetchPodcast } from './parse-podcast.ts';
import { fetchYoutube } from './parse-youtube.ts';
import type { FeedItemDraft } from './normalize.ts';

/**
 * The ingestion run (§3.5). One tick:
 *   load due active sources → fetch+parse (bounded concurrency) → upsert on
 *   (source_id, external_id) → for NEW items, create item_state 'new', seed
 *   item_tag from the source's focus areas (D5), and log an 'ingested' event →
 *   record per-source health. One feed failing never aborts the others.
 *
 * Callable from cron and from POST /api/ingest/run.
 */

export interface PerSourceResult {
  slug: string;
  fetched: number;
  created: number;
  ok: boolean;
  error?: string;
}

export interface IngestResult {
  fetched: number;
  created: number;
  errors: number;
  perSource: PerSourceResult[];
}

export interface RunIngestOptions {
  now?: number;
  concurrency?: number;
  /** Ignore per-source poll intervals and poll every active source now. */
  force?: boolean;
}

function isDue(s: SourceRow, now: number): boolean {
  if (s.lastPolledAt == null) return true;
  return now - s.lastPolledAt >= s.pollIntervalMinutes * 60_000;
}

export async function runIngest(db: DB, opts: RunIngestOptions = {}): Promise<IngestResult> {
  const now = opts.now ?? Date.now();
  const limit = pLimit(opts.concurrency ?? 4);

  const active = await db.select().from(source).where(eq(source.active, true));
  const due = opts.force ? active : active.filter((s) => isDue(s, now));

  const perSource = await Promise.all(due.map((s) => limit(() => ingestSource(db, s, now))));

  return {
    fetched: perSource.reduce((n, r) => n + r.fetched, 0),
    created: perSource.reduce((n, r) => n + r.created, 0),
    errors: perSource.filter((r) => !r.ok).length,
    perSource,
  };
}

async function ingestSource(db: DB, s: SourceRow, now: number): Promise<PerSourceResult> {
  try {
    const drafts: FeedItemDraft[] =
      s.type === 'youtube' ? await fetchYoutube(s) : await fetchPodcast(s);

    // Focus-area tags to seed onto new items (D5).
    const focusTagIds = (
      await db.select({ id: sourceTag.tagId }).from(sourceTag).where(eq(sourceTag.sourceId, s.id))
    ).map((r) => r.id);

    let created = 0;
    for (const d of drafts) {
      const inserted = await db
        .insert(feedItem)
        .values({
          sourceId: s.id,
          externalId: d.externalId,
          title: d.title,
          description: d.description,
          url: d.url,
          thumbnailUrl: d.thumbnailUrl,
          author: d.author,
          publishedAt: d.publishedAt,
          ingestedAt: now,
          rawJson: d.rawJson,
        })
        .onConflictDoNothing() // dedup on (source_id, external_id)
        .returning();

      const item = inserted[0];
      if (!item) continue; // already ingested
      created += 1;

      await db.insert(itemState).values({ itemId: item.id, status: 'new' }).onConflictDoNothing();

      if (focusTagIds.length) {
        await db
          .insert(itemTag)
          .values(focusTagIds.map((tagId) => ({ itemId: item.id, tagId })))
          .onConflictDoNothing();
      }

      await db.insert(itemEvent).values({ itemId: item.id, eventType: 'ingested', at: now });
    }

    await db
      .update(source)
      .set({ lastPolledAt: now, lastStatus: 'ok', lastError: null, updatedAt: now })
      .where(eq(source.id, s.id));

    return { slug: s.slug, fetched: drafts.length, created, ok: true };
  } catch (err) {
    // Resilience over correctness-of-the-whole-batch: record and continue (§3.5, §6).
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(source)
      .set({ lastPolledAt: now, lastStatus: 'error', lastError: message, updatedAt: now })
      .where(eq(source.id, s.id));
    return { slug: s.slug, fetched: 0, created: 0, ok: false, error: message };
  }
}
