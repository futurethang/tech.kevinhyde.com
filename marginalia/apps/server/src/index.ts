import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createDb, loadSourcesConfig, runMigrations } from '@marginalia/core';
import { createApp } from './app.ts';
import { syncSources } from './ingest/sync.ts';
import { startScheduler } from './ingest/scheduler.ts';
import { stubSummarizer } from './llm/summarize.ts';
import { createAnthropicSummarizer } from './llm/summarize-anthropic.ts';

/**
 * Boot sequence (§3.4): open DB → migrate (fail hard) → sync sources from YAML →
 * start in-process cron → serve API (and, from Phase 4, the static PWA). One
 * always-on process, one URL.
 */
async function main(): Promise<void> {
  const appToken = process.env.APP_TOKEN;
  if (!appToken) {
    console.error('FATAL: APP_TOKEN is not set (see .env.example §3.8). Refusing to start.');
    process.exit(1);
  }

  const sourcesConfigPath = process.env.SOURCES_CONFIG_PATH;
  const migrationsDir = process.env.MIGRATIONS_DIR ?? './drizzle';
  const port = Number(process.env.PORT ?? 8080);

  const { db, client } = await createDb();

  await runMigrations(db, migrationsDir);
  console.log('[boot] migrations applied');

  const config = loadSourcesConfig(sourcesConfigPath);
  const sync = await syncSources(db, config);
  console.log('[boot] sources synced', JSON.stringify(sync));

  startScheduler(db, config);

  // Real Anthropic summarizer when a key is set; the stub otherwise (so the app
  // runs end-to-end without a key — summaries just return canned text).
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const summarizer = anthropicKey
    ? createAnthropicSummarizer({ apiKey: anthropicKey, model: process.env.ANTHROPIC_MODEL })
    : stubSummarizer;
  console.log(`[boot] summarizer: ${anthropicKey ? 'anthropic' : 'stub (no ANTHROPIC_API_KEY)'}`);

  const webDist = process.env.WEB_DIST ?? './apps/web/dist';
  const app = createApp({ db, sourcesConfigPath, summarizer, appToken, webDist });

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[boot] ready — http://localhost:${info.port} (db: ${process.env.DATABASE_URL ?? 'file:./data/app.db'})`);
  });

  const shutdown = (): void => {
    console.log('[boot] shutting down');
    client.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[boot] fatal', err);
  process.exit(1);
});
