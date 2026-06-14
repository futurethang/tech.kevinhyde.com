// Phase 2 OFFLINE verification (no network): proves the YouTube/podcast parser
// mapping and syncSources() upsert/seed/deactivate logic. The LIVE dedup + per-source
// resilience checks run after real feed URLs are configured (see PROGRESS NEXT).
// Run from marginalia/:  pnpm tsx scripts/phase2-offline.ts
import { rmSync } from 'node:fs';
import { createDb, runMigrations, source, sourceTag, tag, type SourcesConfig } from '@marginalia/core';
import { parseYoutubeXml } from '../apps/server/src/ingest/parse-youtube.ts';
import { parsePodcastXml } from '../apps/server/src/ingest/parse-podcast.ts';
import { youtubeFeedUrl } from '../apps/server/src/ingest/parse-youtube.ts';
import { syncSources } from '../apps/server/src/ingest/sync.ts';

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error('✗ FAIL:', msg);
    process.exit(1);
  }
  console.log('✓', msg);
}

// ---- 1. exclude_shorts URL transform ---------------------------------------
assert(
  youtubeFeedUrl({
    feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCabc123',
    excludeShorts: true,
  }) === 'https://www.youtube.com/feeds/videos.xml?playlist_id=UULFabc123',
  'exclude_shorts swaps UC… channel feed for UULF… long-form playlist feed',
);
assert(
  youtubeFeedUrl({
    feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCabc123',
    excludeShorts: false,
  }) === 'https://www.youtube.com/feeds/videos.xml?channel_id=UCabc123',
  'exclude_shorts=false leaves the channel feed unchanged',
);

// ---- 2. YouTube Atom mapping -----------------------------------------------
const ytXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>Test Channel</title>
  <entry>
    <id>yt:video:VIDEO123</id>
    <yt:videoId>VIDEO123</yt:videoId>
    <title>Understanding CRDTs</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=VIDEO123"/>
    <author><name>Test Author</name></author>
    <published>2026-06-10T12:00:00+00:00</published>
    <media:group>
      <media:title>Understanding CRDTs</media:title>
      <media:thumbnail url="https://i.ytimg.com/vi/VIDEO123/hqdefault.jpg" width="480" height="360"/>
      <media:description>A deep dive into conflict-free replicated data types and offline sync.</media:description>
    </media:group>
  </entry>
</feed>`;
const [yt] = await parseYoutubeXml(ytXml);
assert(yt?.externalId === 'VIDEO123', `youtube externalId = yt:videoId (${yt?.externalId})`);
assert(yt?.url === 'https://www.youtube.com/watch?v=VIDEO123', 'youtube url = watch link');
assert(yt?.title === 'Understanding CRDTs', 'youtube title parsed');
assert(
  yt?.description?.startsWith('A deep dive into conflict-free'),
  'youtube description pulled from media:group/media:description',
);
assert(
  yt?.thumbnailUrl === 'https://i.ytimg.com/vi/VIDEO123/hqdefault.jpg',
  'youtube thumbnail derived from video id',
);
assert(yt?.publishedAt === Date.parse('2026-06-10T12:00:00+00:00'), 'youtube publishedAt parsed to ms');
assert(JSON.parse(yt!.rawJson)['yt:videoId'] === 'VIDEO123', 'youtube rawJson holds full original entry');

// ---- 3. Podcast RSS mapping -------------------------------------------------
const podXml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Modern Web</title>
    <itunes:image href="https://example.com/cover.jpg"/>
    <item>
      <title>Episode 42: Lit and Web Components</title>
      <link>https://example.com/ep42</link>
      <guid>https://example.com/ep42</guid>
      <pubDate>Wed, 10 Jun 2026 09:00:00 GMT</pubDate>
      <enclosure url="https://example.com/ep42.mp3" length="12345" type="audio/mpeg"/>
      <itunes:author>Jane Dev</itunes:author>
      <content:encoded><![CDATA[<p>Full show notes about Lit and web components.</p>]]></content:encoded>
      <description>Short summary.</description>
    </item>
  </channel>
</rss>`;
const [pod] = await parsePodcastXml(podXml);
assert(pod?.externalId === 'https://example.com/ep42', 'podcast externalId = guid');
assert(pod?.url === 'https://example.com/ep42', 'podcast url = episode page link');
assert(
  pod?.description?.includes('Full show notes about Lit'),
  'podcast description = content:encoded full show notes',
);
assert(pod?.thumbnailUrl === 'https://example.com/cover.jpg', 'podcast thumbnail falls back to feed itunes:image');
assert(pod?.author === 'Jane Dev', 'podcast author = itunes:author');
assert(JSON.parse(pod!.rawJson).enclosure?.url === 'https://example.com/ep42.mp3', 'podcast rawJson keeps enclosure');

// ---- 4. syncSources upsert / seed / deactivate ------------------------------
const DB_PATH = './data/phase2.db';
rmSync(DB_PATH, { force: true });
const { client, db } = await createDb({ url: `file:${DB_PATH}` });
await runMigrations(db, './drizzle');

const cfgA: SourcesConfig = {
  defaults: { poll_interval_minutes: 30 },
  sources: [
    {
      slug: 'chan-a',
      title: 'Channel A',
      type: 'youtube',
      feed_url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCaaa',
      exclude_shorts: true,
      focus_areas: ['architecture', 'engineering-opinion'],
      active: true,
      poll_interval_minutes: 30,
    },
    {
      slug: 'pod-b',
      title: 'Podcast B',
      type: 'podcast',
      feed_url: 'https://feeds.example.com/b.xml',
      exclude_shorts: false,
      focus_areas: ['architecture'],
      active: true,
      poll_interval_minutes: 60,
    },
  ],
};

const sync1 = await syncSources(db, cfgA);
assert(sync1.upserted === 2 && sync1.deactivated === 0, 'first sync upserts 2 sources, deactivates 0');

const tags = await db.select().from(tag);
assert(tags.length === 2, `focus_area tags seeded once, de-duped (${tags.length})`);
assert(
  tags.find((t) => t.slug === 'engineering-opinion')?.label === 'Engineering Opinion',
  'tag label titleized from slug',
);
const links = await db.select().from(sourceTag);
assert(links.length === 3, `source_tag links seeded (${links.length} = 2 + 1)`);

// Re-sync identical config: still 2 sources, no tag/link explosion (idempotent).
await syncSources(db, cfgA);
assert((await db.select().from(tag)).length === 2, 're-sync is idempotent for tags');
assert((await db.select().from(sourceTag)).length === 3, 're-sync is idempotent for links');

// Drop pod-b from YAML → it must be DEACTIVATED, not deleted (history preserved).
const cfgB: SourcesConfig = { defaults: cfgA.defaults, sources: [cfgA.sources[0]!] };
const sync3 = await syncSources(db, cfgB);
assert(sync3.deactivated === 1, 'dropping a source from YAML deactivates exactly 1');
const podB = (await db.select().from(source)).find((s) => s.slug === 'pod-b');
assert(podB != null && podB.active === false, 'dropped source still exists but active=false');

client.close();
rmSync(DB_PATH, { force: true });
console.log('\n✓ Phase 2 offline checks passed');
