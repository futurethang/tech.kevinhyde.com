import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { newId } from './ids.ts';
import { type SourceType } from './constants.ts';

/**
 * Marginalia data model (§3.3). Migration-safety rules baked in here — these are
 * the whole point, do not "optimize" them away:
 *
 *  - ULID text primary keys everywhere (not autoincrement ints): portable/sortable.
 *  - Every table carries created_at + updated_at.
 *  - TIMESTAMP CONVENTION: epoch MILLISECONDS stored as integer. Consistent across
 *    every table. Readable enough in raw SQL; trivial in JS (Date.now()).
 *  - Status/type fields are TEXT with a documented allowed set (the *_VALUES consts
 *    below), constrained at the TS level via .$type<>() — NOT integer enums. This
 *    keeps them readable in raw SQL and trivially extensible.
 *  - feed_item keeps the full original entry in raw_json (D1) — the single most
 *    important hedge against feeds that can't be re-fetched.
 *  - summary rows are append-only, keyed by (model, prompt_version, input_kind) (D2)
 *    — NO unique constraint, so "regenerate" adds a row instead of overwriting.
 *  - tag.kind unifies focus_areas + user_tags in one table (D3).
 *  - item_state is its own table (D4) so re-ingesting never clobbers triage.
 */

// ---- Allowed value sets (documented; columns stay TEXT) ---------------------

// SourceType / SOURCE_TYPE_VALUES live in constants.ts (shared with the config loader).

export const SOURCE_STATUS_VALUES = ['ok', 'error'] as const;
export type SourceStatus = (typeof SOURCE_STATUS_VALUES)[number];

export const TAG_KIND_VALUES = ['focus_area', 'user_tag'] as const;
export type TagKind = (typeof TAG_KIND_VALUES)[number];

export const ITEM_STATUS_VALUES = ['new', 'queued', 'ignored', 'saved'] as const;
export type ItemStatus = (typeof ITEM_STATUS_VALUES)[number];

export const SUMMARY_INPUT_KIND_VALUES = ['metadata', 'transcript'] as const;
export type SummaryInputKind = (typeof SUMMARY_INPUT_KIND_VALUES)[number];

// ---- Shared column builders -------------------------------------------------

/** ULID text primary key, defaulted in app code. */
const pk = () => text('id').primaryKey().$defaultFn(newId);

/** created_at + updated_at, epoch ms. Spread into every table. */
const timestamps = {
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at')
    .notNull()
    .$defaultFn(() => Date.now())
    .$onUpdate(() => Date.now()),
};

// ---- Tables -----------------------------------------------------------------

/** A configured feed. Synced from config/sources.yaml by `slug`; runtime state lives here. */
export const source = sqliteTable('source', {
  id: pk(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  type: text('type').$type<SourceType>().notNull(),
  feedUrl: text('feed_url').notNull(),
  excludeShorts: integer('exclude_shorts', { mode: 'boolean' }).notNull().default(false),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  pollIntervalMinutes: integer('poll_interval_minutes').notNull(),
  // Runtime state, updated by the ingest loop:
  lastPolledAt: integer('last_polled_at'),
  lastStatus: text('last_status').$type<SourceStatus>(),
  lastError: text('last_error'),
  ...timestamps,
});

/** Unified taxonomy — both curated focus areas and ad-hoc user tags, split by `kind`. */
export const tag = sqliteTable('tag', {
  id: pk(),
  slug: text('slug').notNull().unique(),
  label: text('label').notNull(),
  kind: text('kind').$type<TagKind>().notNull(),
  ...timestamps,
});

/** source ↔ focus_area, seeded from `focus_areas` in YAML. */
export const sourceTag = sqliteTable(
  'source_tag',
  {
    sourceId: text('source_id')
      .notNull()
      .references(() => source.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tag.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.sourceId, t.tagId] })],
);

/** An ingested item (immutable-ish). Dedup key = (source_id, external_id). */
export const feedItem = sqliteTable(
  'feed_item',
  {
    id: pk(),
    sourceId: text('source_id')
      .notNull()
      .references(() => source.id, { onDelete: 'cascade' }),
    // yt:videoId for YouTube; RSS guid (or hashed link fallback) for podcasts.
    externalId: text('external_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    // Canonical deep-link target (watch URL / episode page).
    url: text('url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    author: text('author'),
    publishedAt: integer('published_at'),
    ingestedAt: integer('ingested_at').notNull(),
    // D1: the entire original feed entry, JSON-stringified. Never discard.
    rawJson: text('raw_json').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('feed_item_source_external_idx').on(t.sourceId, t.externalId)],
);

/** item ↔ user_tag (m:n). User-applied tags; may be seeded from source focus areas (D5). */
export const itemTag = sqliteTable(
  'item_tag',
  {
    itemId: text('item_id')
      .notNull()
      .references(() => feedItem.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tag.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.itemId, t.tagId] })],
);

/** Per-item triage state, 1:1 with feed_item. Created as 'new' at ingest (D4). */
export const itemState = sqliteTable('item_state', {
  id: pk(),
  itemId: text('item_id')
    .notNull()
    .unique()
    .references(() => feedItem.id, { onDelete: 'cascade' }),
  status: text('status').$type<ItemStatus>().notNull().default('new'),
  queuedAt: integer('queued_at'),
  ignoredAt: integer('ignored_at'),
  savedAt: integer('saved_at'),
  ...timestamps,
});

/** User-authored notes. Many per item allowed; survive source deletion. */
export const note = sqliteTable(
  'note',
  {
    id: pk(),
    itemId: text('item_id')
      .notNull()
      .references(() => feedItem.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    ...timestamps,
  },
  (t) => [index('note_item_idx').on(t.itemId)],
);

/**
 * LLM-generated summary. D2: append-only — keyed conceptually by
 * (item_id, model, prompt_version, input_kind) but with NO unique constraint, so
 * "regenerate with a better model/prompt" adds a row instead of overwriting.
 * input_kind reserves the seam for future transcript-based summaries (no migration).
 */
export const summary = sqliteTable(
  'summary',
  {
    id: pk(),
    itemId: text('item_id')
      .notNull()
      .references(() => feedItem.id, { onDelete: 'cascade' }),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    inputKind: text('input_kind').$type<SummaryInputKind>().notNull(),
    body: text('body').notNull(),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    generatedAt: integer('generated_at').notNull(),
    ...timestamps,
  },
  (t) => [index('summary_item_idx').on(t.itemId)],
);

/** Append-only audit log. Cheap now; its *history* is not backfillable later. */
export const itemEvent = sqliteTable(
  'item_event',
  {
    id: pk(),
    itemId: text('item_id')
      .notNull()
      .references(() => feedItem.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    at: integer('at').notNull(),
    ...timestamps,
  },
  (t) => [index('item_event_item_idx').on(t.itemId)],
);

// Re-export sql in case migration helpers need it downstream.
export { sql };
