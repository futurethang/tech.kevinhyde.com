import { createHash } from 'node:crypto';

/**
 * A normalized, source-agnostic draft of an ingested item (§3.5). Both the YouTube
 * and podcast parsers produce these; runIngest() turns them into feed_item rows.
 * `description` is kept FULL (it's recall fuel) and `rawJson` is the entire original
 * entry (D1 — the hedge against feeds that can't be re-fetched).
 */
export interface FeedItemDraft {
  externalId: string;
  title: string;
  description: string | null;
  url: string;
  thumbnailUrl: string | null;
  author: string | null;
  publishedAt: number | null; // epoch ms
  rawJson: string;
}

/** Parse a date string to epoch ms, or null. Treats feed input as untrusted. */
export function parseDateMs(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/** Stable hash for external_id fallback when a feed lacks a guid. */
export function hashId(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

/** Trim a value to a non-empty string, or null. */
export function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t === '' ? null : t;
}

/** Safe property read off an unknown object. */
export function getProp(obj: unknown, key: string): unknown {
  if (obj !== null && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/** xml2js often wraps single elements in arrays; unwrap the first. */
export function firstOf(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

/** 'engineering-opinion' -> 'Engineering Opinion' (for tag labels). */
export function titleizeSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w === '' ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(' ');
}
