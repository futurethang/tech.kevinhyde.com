import cron, { type ScheduledTask } from 'node-cron';
import type { DB, SourcesConfig } from '@marginalia/core';
import { runIngest } from './run.ts';

/**
 * In-process scheduler (§3.4). node-cron ticks on a cadence derived from the
 * smallest configured poll interval; per-source gating (which sources are actually
 * due) lives in runIngest(). One always-on process, no separate worker host.
 */

/** Pick a tick cadence: the smallest source interval, clamped to [1, 60] minutes. */
export function tickMinutes(config: SourcesConfig): number {
  const intervals = config.sources.map((s) => s.poll_interval_minutes);
  const smallest = intervals.length ? Math.min(...intervals) : config.defaults.poll_interval_minutes;
  return Math.min(60, Math.max(1, smallest));
}

export function startScheduler(db: DB, config: SourcesConfig): ScheduledTask {
  const minutes = tickMinutes(config);
  const expression = `*/${minutes} * * * *`;
  console.log(`[scheduler] ingest tick every ${minutes}m (${expression})`);

  return cron.schedule(expression, async () => {
    try {
      const result = await runIngest(db);
      if (result.fetched > 0 || result.errors > 0) {
        console.log('[ingest]', JSON.stringify(result));
      }
    } catch (err) {
      console.error('[ingest] tick failed', err);
    }
  });
}
