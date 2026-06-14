import { and, eq, notInArray } from 'drizzle-orm';
import type { DB, SourcesConfig } from '@marginalia/core';
import { source, sourceTag, tag } from '@marginalia/core';
import { titleizeSlug } from './normalize.ts';

/**
 * Sync config/sources.yaml into the DB (§3.2). Upserts `source` by slug, seeds
 * focus_area `tag`s + `source_tag` links, and DEACTIVATES (never deletes) sources
 * whose slug has vanished from the YAML — history is preserved.
 *
 * Precedence: the YAML is declarative truth, so `active` here wins; runtime fields
 * (last_polled_at, last_error, ...) are left untouched.
 */
export interface SyncResult {
  upserted: number;
  deactivated: number;
}

export async function syncSources(db: DB, config: SourcesConfig): Promise<SyncResult> {
  const now = Date.now();
  const yamlSlugs = config.sources.map((s) => s.slug);

  for (const s of config.sources) {
    const [row] = await db
      .insert(source)
      .values({
        slug: s.slug,
        title: s.title,
        type: s.type,
        feedUrl: s.feed_url,
        excludeShorts: s.exclude_shorts,
        active: s.active,
        pollIntervalMinutes: s.poll_interval_minutes,
      })
      .onConflictDoUpdate({
        target: source.slug,
        // Declarative fields only — never clobber runtime state.
        set: {
          title: s.title,
          type: s.type,
          feedUrl: s.feed_url,
          excludeShorts: s.exclude_shorts,
          active: s.active,
          pollIntervalMinutes: s.poll_interval_minutes,
          updatedAt: now,
        },
      })
      .returning();

    const sourceId = row!.id;

    // Seed focus_area tags + links.
    const focusTagIds: string[] = [];
    for (const fa of s.focus_areas) {
      const [t] = await db
        .insert(tag)
        .values({ slug: fa, label: titleizeSlug(fa), kind: 'focus_area' })
        .onConflictDoUpdate({ target: tag.slug, set: { updatedAt: now } })
        .returning();
      focusTagIds.push(t!.id);
      await db.insert(sourceTag).values({ sourceId, tagId: t!.id }).onConflictDoNothing();
    }

    // Re-assert YAML: drop source_tag links no longer listed in focus_areas.
    await db
      .delete(sourceTag)
      .where(
        focusTagIds.length
          ? and(eq(sourceTag.sourceId, sourceId), notInArray(sourceTag.tagId, focusTagIds))
          : eq(sourceTag.sourceId, sourceId),
      );
  }

  // Deactivate (don't delete) sources dropped from YAML.
  const deactivated = await db
    .update(source)
    .set({ active: false, updatedAt: now })
    .where(notInArray(source.slug, yamlSlugs))
    .returning();

  return { upserted: config.sources.length, deactivated: deactivated.length };
}
