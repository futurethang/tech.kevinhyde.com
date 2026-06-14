/**
 * Shared value-sets with no framework/DB dependency, so both the config loader
 * (sources-config.ts) and the DB schema (schema.ts) can agree on one definition.
 */

export const SOURCE_TYPE_VALUES = ['youtube', 'podcast'] as const;
export type SourceType = (typeof SOURCE_TYPE_VALUES)[number];
