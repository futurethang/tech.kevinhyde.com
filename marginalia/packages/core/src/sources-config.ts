import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { SOURCE_TYPE_VALUES } from './constants.ts';

/**
 * config/sources.yaml is the declarative source of truth for WHICH feeds exist
 * and their metadata (§3.2). This module loads it, validates it loudly with Zod,
 * and exposes a typed, normalized view. It has zero framework/DB dependencies so
 * packages/core stays framework-free (§6).
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A single feed entry, exactly as written in YAML (pre-normalization). */
const RawSourceSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .regex(SLUG_RE, 'slug must be lowercase alphanumerics separated by single hyphens'),
    title: z.string().min(1),
    type: z.enum(SOURCE_TYPE_VALUES),
    feed_url: z.url(),
    exclude_shorts: z.boolean().default(false),
    focus_areas: z.array(z.string().regex(SLUG_RE, 'focus_area must be a slug')).default([]),
    active: z.boolean().default(true),
    // Optional per-source override; falls back to defaults.poll_interval_minutes.
    poll_interval_minutes: z.int().positive().optional(),
  })
  .superRefine((src, ctx) => {
    if (src.type === 'podcast' && src.exclude_shorts) {
      ctx.addIssue({
        code: 'custom',
        path: ['exclude_shorts'],
        message: 'exclude_shorts only applies to youtube sources',
      });
    }
  });

const DefaultsSchema = z
  .object({
    poll_interval_minutes: z.int().positive().default(30),
  })
  .default({ poll_interval_minutes: 30 });

const RawConfigSchema = z
  .object({
    defaults: DefaultsSchema,
    sources: z.array(RawSourceSchema).min(1, 'at least one source is required'),
  })
  .superRefine((cfg, ctx) => {
    const seen = new Set<string>();
    cfg.sources.forEach((src, i) => {
      if (seen.has(src.slug)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sources', i, 'slug'],
          message: `duplicate slug "${src.slug}" — slugs are the stable identity key and must be unique`,
        });
      }
      seen.add(src.slug);
    });
  });

export type RawSourceConfig = z.infer<typeof RawSourceSchema>;

/** A source with its effective poll interval resolved against defaults. */
export interface NormalizedSource extends Omit<RawSourceConfig, 'poll_interval_minutes'> {
  poll_interval_minutes: number;
}

export interface SourcesConfig {
  defaults: { poll_interval_minutes: number };
  sources: NormalizedSource[];
}

export class SourcesConfigError extends Error {
  override name = 'SourcesConfigError';
}

/**
 * Load, parse, and validate config/sources.yaml. Throws a readable
 * SourcesConfigError on any malformed/invalid file — fail loudly (§3.2).
 */
export function loadSourcesConfig(configPath?: string): SourcesConfig {
  const path = resolve(
    configPath ?? process.env.SOURCES_CONFIG_PATH ?? './config/sources.yaml',
  );

  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    throw new SourcesConfigError(
      `Could not read sources config at "${path}": ${(err as Error).message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (err) {
    throw new SourcesConfigError(`Invalid YAML in "${path}": ${(err as Error).message}`);
  }

  const result = RawConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new SourcesConfigError(
      `Invalid sources config in "${path}":\n${formatZodIssues(result.error)}`,
    );
  }

  const { defaults, sources } = result.data;
  return {
    defaults,
    sources: sources.map((src) => ({
      ...src,
      poll_interval_minutes: src.poll_interval_minutes ?? defaults.poll_interval_minutes,
    })),
  };
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const where = issue.path.length ? issue.path.join('.') : '(root)';
      return `  • ${where}: ${issue.message}`;
    })
    .join('\n');
}
