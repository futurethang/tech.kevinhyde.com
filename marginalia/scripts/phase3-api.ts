// Phase 3 verification: exercise the full API surface (§3.7) against a seeded DB
// via Hono's app.request() — no port, no network. Run from marginalia/:
//   pnpm tsx scripts/phase3-api.ts
import { rmSync } from 'node:fs';
import { createDb, runMigrations, feedItem, itemState, source, sourceTag, tag } from '@marginalia/core';
import { createApp } from '../apps/server/src/app.ts';
import { stubSummarizer } from '../apps/server/src/llm/summarize.ts';

const TOKEN = 'testtoken';
const DB_PATH = './data/api-test.db';
rmSync(DB_PATH, { force: true });

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error('✗ FAIL:', msg);
    process.exit(1);
  }
  console.log('✓', msg);
}

const { client, db } = await createDb({ url: `file:${DB_PATH}` });
await runMigrations(db, './drizzle');

// ---- Seed: one source, two items with state, one focus tag -----------------
const [src] = await db
  .insert(source)
  .values({
    slug: 'seed-yt',
    title: 'Seed Channel',
    type: 'youtube',
    feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCseed',
    pollIntervalMinutes: 30,
  })
  .returning();
const [focus] = await db
  .insert(tag)
  .values({ slug: 'architecture', label: 'Architecture', kind: 'focus_area' })
  .returning();
await db.insert(sourceTag).values({ sourceId: src!.id, tagId: focus!.id });

const itemIds: string[] = [];
for (const t of ['Understanding CRDTs', 'Lit Web Components Deep Dive']) {
  const [it] = await db
    .insert(feedItem)
    .values({
      sourceId: src!.id,
      externalId: `ext-${t}`,
      title: t,
      description: `A talk about ${t}.`,
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(t)}`,
      ingestedAt: Date.now(),
      rawJson: '{}',
    })
    .returning();
  await db.insert(itemState).values({ itemId: it!.id, status: 'new' });
  itemIds.push(it!.id);
}
const itemId = itemIds[0]!;

// ---- Build the app ----------------------------------------------------------
const app = createApp({
  db,
  sourcesConfigPath: './config/sources.yaml',
  summarizer: stubSummarizer,
  appToken: TOKEN,
});

async function req(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; json: unknown }> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await app.request(path, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

// ---- Auth -------------------------------------------------------------------
assert((await req('GET', '/api/healthz')).status === 200, 'GET /api/healthz is 200 without a token');
assert((await req('GET', '/api/items')).status === 401, 'GET /api/items without token is 401');
assert(
  (await req('GET', '/api/items', { token: 'wrong' })).status === 401,
  'GET /api/items with a wrong token is 401',
);

// ---- List / filter / search -------------------------------------------------
const list = await req('GET', '/api/items', { token: TOKEN });
assert(
  list.status === 200 && (list.json as { items: unknown[] }).items.length === 2,
  'GET /api/items returns the 2 seeded items',
);
const first = (list.json as { items: { id: string; status: string; hasSummary: boolean; tags: unknown[] }[] })
  .items[0]!;
assert(first.status === 'new' && !first.hasSummary, 'list item shows status=new, hasSummary=false');

const search = await req('GET', '/api/items?q=CRDT', { token: TOKEN });
assert((search.json as { items: unknown[] }).items.length === 1, 'text search q=CRDT matches 1 item');

// ---- State transition -------------------------------------------------------
const patched = await req('PATCH', `/api/items/${itemId}/state`, { token: TOKEN, body: { status: 'queued' } });
assert(
  patched.status === 200 && (patched.json as { status: string; queuedAt: number }).status === 'queued',
  'PATCH state → queued',
);
assert((patched.json as { queuedAt: number }).queuedAt > 0, 'queuedAt timestamp stamped');
const queuedList = await req('GET', '/api/items?status=queued', { token: TOKEN });
assert((queuedList.json as { items: unknown[] }).items.length === 1, 'filter status=queued returns 1');

// ---- Tags -------------------------------------------------------------------
const tagged = await req('POST', `/api/items/${itemId}/tags`, { token: TOKEN, body: { label: 'Deep Dive' } });
assert(
  tagged.status === 201 && (tagged.json as { slug: string }).slug === 'deep-dive',
  'POST tag creates user tag with slugified slug',
);
const taggedFilter = await req('GET', '/api/items?tag=deep-dive', { token: TOKEN });
assert((taggedFilter.json as { items: unknown[] }).items.length === 1, 'filter tag=deep-dive returns 1');
assert(
  (await req('DELETE', `/api/items/${itemId}/tags/deep-dive`, { token: TOKEN })).status === 204,
  'DELETE tag link → 204',
);
assert(
  (await req('GET', '/api/items?tag=deep-dive', { token: TOKEN }).then((r) => (r.json as { items: unknown[] }).items.length)) === 0,
  'tag filter empty after delete',
);

// ---- Notes ------------------------------------------------------------------
const noteRes = await req('POST', `/api/items/${itemId}/notes`, { token: TOKEN, body: { body: 'Revisit causal ordering.' } });
assert(noteRes.status === 201, 'POST note → 201');
const noteId = (noteRes.json as { id: string }).id;
const detail = await req('GET', `/api/items/${itemId}`, { token: TOKEN });
assert(
  (detail.json as { notes: { body: string }[] }).notes.some((n) => n.body === 'Revisit causal ordering.'),
  'GET detail includes the note',
);
const noteSearch = await req('GET', '/api/items?q=causal', { token: TOKEN });
assert((noteSearch.json as { items: unknown[] }).items.length === 1, 'text search also covers note bodies');
assert(
  (await req('PATCH', `/api/notes/${noteId}`, { token: TOKEN, body: { body: 'edited' } }).then((r) => (r.json as { body: string }).body)) === 'edited',
  'PATCH note edits body',
);
assert((await req('DELETE', `/api/notes/${noteId}`, { token: TOKEN })).status === 204, 'DELETE note → 204');

// ---- Summary (stub): generate → cache → regenerate --------------------------
const gen1 = await req('POST', `/api/items/${itemId}/summary`, { token: TOKEN });
assert(gen1.status === 201 && (gen1.json as { cached: boolean }).cached === false, 'POST summary generates (cached=false)');
const gen2 = await req('POST', `/api/items/${itemId}/summary`, { token: TOKEN });
assert((gen2.json as { cached: boolean }).cached === true, 'second POST returns cached summary');
const regen = await req('POST', `/api/items/${itemId}/summary?regenerate=true`, { token: TOKEN });
assert((regen.json as { cached: boolean }).cached === false, 'POST ?regenerate=true makes a new summary');
const detail2 = await req('GET', `/api/items/${itemId}`, { token: TOKEN });
assert((detail2.json as { summaries: unknown[] }).summaries.length === 2, 'detail shows 2 append-only summary rows');
assert((await req('GET', `/api/items/${itemId}/summary`, { token: TOKEN })).status === 200, 'GET summary returns latest');
const listAfterSummary = await req('GET', `/api/items`, { token: TOKEN });
assert(
  (listAfterSummary.json as { items: { id: string; hasSummary: boolean }[] }).items.find((i) => i.id === itemId)?.hasSummary === true,
  'list now shows hasSummary=true for the summarized item',
);

// ---- Sources + sync + ingest (resilient) ------------------------------------
assert((await req('GET', '/api/sources', { token: TOKEN })).status === 200, 'GET /api/sources → 200');
const sync = await req('POST', '/api/sources/sync', { token: TOKEN });
assert((sync.json as { upserted: number }).upserted === 2, 'POST /api/sources/sync upserts the 2 YAML sources');
// Point active sources at a fast-failing local URL so the resilience check is
// deterministic and network-independent (real feeds can't be reached here anyway).
await db.update(source).set({ feedUrl: 'http://127.0.0.1:1/feed.xml', updatedAt: Date.now() });
const ingest = await req('POST', '/api/ingest/run', { token: TOKEN });
// REPLACE_ME feeds are unreachable (placeholder hosts) — must NOT throw; errors recorded.
assert(
  ingest.status === 200 && (ingest.json as { errors: number }).errors >= 1,
  `POST /api/ingest/run is resilient (errors=${(ingest.json as { errors: number }).errors}, no crash)`,
);

// ---- 404s -------------------------------------------------------------------
assert((await req('GET', '/api/items/nonexistent', { token: TOKEN })).status === 404, 'GET unknown item → 404');

client.close();
rmSync(DB_PATH, { force: true });
console.log('\n✓ Phase 3 API checks passed');
