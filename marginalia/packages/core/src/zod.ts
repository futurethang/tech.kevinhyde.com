import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import {
  feedItem,
  itemEvent,
  itemState,
  itemTag,
  note,
  source,
  sourceTag,
  summary,
  tag,
} from './schema.ts';

/**
 * Single source of truth for shapes across DB / API / PWA (§2). drizzle-zod
 * derives insert/select schemas straight from the Drizzle tables; hand-written
 * API DTOs (request/response shapes) build on top of these and are added per the
 * API surface in §3.7 as routes land (Phase 3).
 */

// ---- Insert schemas (validate writes) ---------------------------------------
export const insertSourceSchema = createInsertSchema(source);
export const insertTagSchema = createInsertSchema(tag);
export const insertSourceTagSchema = createInsertSchema(sourceTag);
export const insertFeedItemSchema = createInsertSchema(feedItem);
export const insertItemTagSchema = createInsertSchema(itemTag);
export const insertItemStateSchema = createInsertSchema(itemState);
export const insertNoteSchema = createInsertSchema(note);
export const insertSummarySchema = createInsertSchema(summary);
export const insertItemEventSchema = createInsertSchema(itemEvent);

// ---- Select schemas (validate / type reads) ---------------------------------
export const selectSourceSchema = createSelectSchema(source);
export const selectTagSchema = createSelectSchema(tag);
export const selectFeedItemSchema = createSelectSchema(feedItem);
export const selectItemStateSchema = createSelectSchema(itemState);
export const selectNoteSchema = createSelectSchema(note);
export const selectSummarySchema = createSelectSchema(summary);
export const selectItemEventSchema = createSelectSchema(itemEvent);

// ---- Inferred row types -----------------------------------------------------
export type SourceRow = z.infer<typeof selectSourceSchema>;
export type TagRow = z.infer<typeof selectTagSchema>;
export type FeedItemRow = z.infer<typeof selectFeedItemSchema>;
export type ItemStateRow = z.infer<typeof selectItemStateSchema>;
export type NoteRow = z.infer<typeof selectNoteSchema>;
export type SummaryRow = z.infer<typeof selectSummarySchema>;
export type ItemEventRow = z.infer<typeof selectItemEventSchema>;
