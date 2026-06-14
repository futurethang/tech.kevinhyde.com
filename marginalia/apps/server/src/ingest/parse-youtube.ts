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
 * YouTube channel feeds are Atom + yt:/media: namespaces (§3.5). We capture
 * yt:videoId and the media:group blob; the watch URL and thumbnail are derived
 * reliably from the video id, and rawJson keeps everything else.
 */

type YtItem = Parser.Item & Record<string, unknown>;

const parser: Parser<Record<string, unknown>, YtItem> = new Parser({
  customFields: {
    item: ['yt:videoId', ['media:group', 'mediaGroup']],
  },
});

/**
 * Build the feed URL to actually fetch. When exclude_shorts is set, swap the
 * channel feed for the channel's long-form uploads playlist: replace the leading
 * `UC` of the channel id with `UULF` and use playlist_id (§7.3). Falls back to the
 * configured feed_url if the channel id can't be extracted.
 */
export function youtubeFeedUrl(source: Pick<SourceRow, 'feedUrl' | 'excludeShorts'>): string {
  if (!source.excludeShorts) return source.feedUrl;
  try {
    const u = new URL(source.feedUrl);
    const channelId = u.searchParams.get('channel_id');
    if (channelId && channelId.startsWith('UC')) {
      const playlistId = `UULF${channelId.slice(2)}`;
      return `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
    }
  } catch {
    // malformed URL — fall back below
  }
  return source.feedUrl;
}

/** Extract the video id from a `yt:video:VIDEOID` guid, if present. */
function videoIdFromGuid(guid: unknown): string | null {
  const s = asString(guid);
  if (!s) return null;
  const parts = s.split(':');
  return parts.length ? (parts.at(-1) ?? null) : null;
}

/** Pull a description out of the media:group blob (shape varies by xml2js settings). */
function mediaGroupDescription(mediaGroup: unknown): string | null {
  return asString(firstOf(getProp(mediaGroup, 'media:description')));
}

/** Pure mapping from parsed Atom items to drafts (network-free; unit-testable). */
export function mapYoutubeItems(items: YtItem[]): FeedItemDraft[] {
  return items.map((item) => {
    const videoId =
      asString(item['yt:videoId']) ??
      videoIdFromGuid(item.guid) ??
      hashId((asString(item.link) ?? '') + (asString(item.title) ?? ''));

    const url =
      asString(item.link) ?? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

    const description =
      mediaGroupDescription(item['mediaGroup']) ??
      asString(item.contentSnippet) ??
      asString(item.content);

    return {
      externalId: videoId,
      title: asString(item.title) ?? '(untitled)',
      description,
      url,
      // Reliable, no fragile media:thumbnail parsing required.
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      author: asString(item.author) ?? asString(item.creator),
      publishedAt: parseDateMs(item.isoDate ?? item.pubDate),
      rawJson: JSON.stringify(item),
    };
  });
}

export async function fetchYoutube(source: SourceRow): Promise<FeedItemDraft[]> {
  const feed = await parser.parseURL(youtubeFeedUrl(source));
  return mapYoutubeItems(feed.items);
}

/** Parse a feed from an XML string (for offline tests). */
export async function parseYoutubeXml(xml: string): Promise<FeedItemDraft[]> {
  const feed = await parser.parseString(xml);
  return mapYoutubeItems(feed.items);
}
