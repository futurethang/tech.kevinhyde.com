import Parser from 'rss-parser';
import type { SourceRow } from '@marginalia/core';
import {
  asString,
  firstOf,
  getProp,
  hashId,
  parseDateMs,
  type FeedItemDraft,
} from './normalize.ts';

/**
 * Podcast feeds are RSS 2.0 with enclosure + itunes: + content:encoded (§3.5).
 * url is the episode page (the deep-link target); the audio enclosure lives in
 * rawJson. content:encoded is the full show notes — kept as description (recall fuel).
 */

type PodcastItem = Parser.Item & Record<string, unknown>;

const parser: Parser<Record<string, unknown>, PodcastItem> = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['itunes:image', 'itunesImage'],
      ['itunes:author', 'itunesAuthor'],
      ['itunes:duration', 'itunesDuration'],
      ['itunes:episode', 'itunesEpisode'],
    ],
  },
});

/** itunes:image is `<itunes:image href="...">`; dig the href out defensively. */
function itunesImageHref(value: unknown): string | null {
  const attrs = getProp(firstOf(value), '$');
  return asString(getProp(attrs, 'href'));
}

/** Pure mapping from parsed RSS items to drafts (network-free; unit-testable). */
export function mapPodcastItems(items: PodcastItem[], feedImage: string | null): FeedItemDraft[] {
  return items.map((item) => {
    const externalId =
      asString(item.guid) ?? hashId((asString(item.link) ?? '') + (asString(item.title) ?? ''));

    const description =
      asString(item['contentEncoded']) ??
      asString(item.content) ??
      asString(item.contentSnippet) ??
      asString(item.summary);

    return {
      externalId,
      title: asString(item.title) ?? '(untitled)',
      description,
      url: asString(item.link) ?? asString(item.enclosure?.url) ?? '',
      thumbnailUrl:
        itunesImageHref(item['itunesImage']) ??
        asString(getProp(getProp(item, 'itunes'), 'image')) ??
        feedImage,
      author: asString(item['itunesAuthor']) ?? asString(item.creator),
      publishedAt: parseDateMs(item.isoDate ?? item.pubDate),
      rawJson: JSON.stringify(item),
    };
  });
}

function feedImageUrl(feed: Parser.Output<PodcastItem>): string | null {
  // rss-parser's built-in itunes support maps channel <itunes:image> to feed.itunes.image
  // (a plain href string); RSS <image><url> lands on feed.image.url.
  return (
    asString(feed.image?.url) ??
    asString(getProp(getProp(feed, 'itunes'), 'image')) ??
    itunesImageHref(getProp(feed, 'itunes:image'))
  );
}

export async function fetchPodcast(source: SourceRow): Promise<FeedItemDraft[]> {
  const feed = await parser.parseURL(source.feedUrl);
  return mapPodcastItems(feed.items, feedImageUrl(feed));
}

/** Parse a feed from an XML string (for offline tests). */
export async function parsePodcastXml(xml: string): Promise<FeedItemDraft[]> {
  const feed = await parser.parseString(xml);
  return mapPodcastItems(feed.items, feedImageUrl(feed));
}
