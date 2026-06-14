import type { DB } from '@marginalia/core';
import type { Summarizer } from './llm/summarize.ts';

/** Dependencies injected into route factories (§3.7). */
export interface AppDeps {
  db: DB;
  /** Path to config/sources.yaml, used by POST /api/sources/sync. */
  sourcesConfigPath: string | undefined;
  summarizer: Summarizer;
}
