// Phase 1 verification: apply migrations to a fresh DB and round-trip one of each
// core entity, then prove the (source_id, external_id) dedup index rejects a dupe.
// Throwaway — not part of the app. Run: pnpm tsx scripts/phase1-smoke.ts
import { rmSync } from 'node:fs';
import {
  createDb,
  runMigrations,
  source,
  tag,
  sourceTag,
  feedItem,
  itemState,
  note,
  summary,
} from '@marginalia/core';

const DB_PATH = './data/smoke.db';
rmSync(DB_PATH, { force: true });

const { client, db } = await createDb({ url: `file:${DB_PATH}` });
await runMigrations(db, './drizzle');
console.log('✓ migrations applied to fresh', DB_PATH);

const [src] = await db
  .insert(source)
  .values({
    slug: 'smoke-source',
    title: 'Smoke Source',
    type: 'youtube',
    feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsmoke',
    excludeShorts: true,
    pollIntervalMinutes: 30,
  })
  .returning();

const [focusTag] = await db
  .insert(tag)
  .values({ slug: 'architecture', label: 'Architecture', kind: 'focus_area' })
  .returning();

await db.insert(sourceTag).values({ sourceId: src!.id, tagId: focusTag!.id });

const [item] = await db
  .insert(feedItem)
  .values({
    sourceId: src!.id,
    externalId: 'yt:video:abc123',
    title: 'CRDTs and offline sync',
    description: 'A deep dive into conflict-free replicated data types.',
    url: 'https://www.youtube.com/watch?v=abc123',
    ingestedAt: Date.now(),
    rawJson: JSON.stringify({ 'yt:videoId': 'abc123', title: 'CRDTs and offline sync' }),
  })
  .returning();

const [state] = await db
  .insert(itemState)
  .values({ itemId: item!.id, status: 'new' })
  .returning();

const [n] = await db
  .insert(note)
  .values({ itemId: item!.id, body: 'Revisit the section on causal ordering.' })
  .returning();

const [sum] = await db
  .insert(summary)
  .values({
    itemId: item!.id,
    model: 'claude-haiku-4-5',
    promptVersion: 'v1',
    inputKind: 'metadata',
    body: 'Tight summary of CRDTs.',
    generatedAt: Date.now(),
  })
  .returning();

console.log('✓ inserted source:', src!.id, src!.slug);
console.log('✓ inserted tag + source_tag link');
console.log('✓ inserted feed_item:', item!.id, JSON.stringify(item!.rawJson));
console.log('✓ inserted item_state:', state!.status);
console.log('✓ inserted note:', n!.body);
console.log('✓ inserted summary:', sum!.model, sum!.promptVersion, sum!.inputKind);

// Read back via relational query path.
const readItem = await db.query.feedItem.findFirst({ where: (f, { eq }) => eq(f.id, item!.id) });
console.log('✓ read back feed_item.raw_json present:', Boolean(readItem?.rawJson));

// Dedup: same (source_id, external_id) must violate the unique index.
let dedupHeld = false;
try {
  await db.insert(feedItem).values({
    sourceId: src!.id,
    externalId: 'yt:video:abc123',
    title: 'dupe',
    url: 'https://example.com',
    ingestedAt: Date.now(),
    rawJson: '{}',
  });
} catch (err) {
  dedupHeld = true;
  console.log('✓ dedup index rejected duplicate (source_id, external_id):', (err as Error).message);
}
if (!dedupHeld) {
  console.error('✗ FAIL: duplicate insert was NOT rejected');
  process.exit(1);
}

// Append-only summary: a second summary for the same (model, prompt_version, input_kind)
// must succeed (no unique constraint) — proving "regenerate" can add rows.
await db.insert(summary).values({
  itemId: item!.id,
  model: 'claude-haiku-4-5',
  promptVersion: 'v1',
  inputKind: 'metadata',
  body: 'Regenerated summary.',
  generatedAt: Date.now(),
});
const summaries = await db.query.summary.findMany({ where: (s, { eq }) => eq(s.itemId, item!.id) });
console.log('✓ append-only summary: rows for item =', summaries.length, '(expected 2)');
if (summaries.length !== 2) {
  console.error('✗ FAIL: expected 2 summary rows');
  process.exit(1);
}

client.close();
rmSync(DB_PATH, { force: true });
console.log('\n✓ Phase 1 smoke test passed');
