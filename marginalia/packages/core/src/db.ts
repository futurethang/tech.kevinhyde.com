import { createClient, type Client, type Config } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema.ts';

/**
 * libSQL client + Drizzle init (§3.4). libSQL is async by design — this is what
 * buys the Turso escape hatch: flip DATABASE_URL from `file:...` to a Turso libSQL
 * URL (+ auth token) with zero code change.
 */

export type Schema = typeof schema;
export type DB = LibSQLDatabase<Schema>;

export const DEFAULT_DATABASE_URL = 'file:./data/app.db';

export interface DbHandle {
  client: Client;
  db: DB;
}

/**
 * Create the libSQL client + Drizzle db and turn on foreign-key enforcement
 * (SQLite/libSQL leave it off by default). Caller owns the lifecycle.
 */
export async function createDb(config?: Partial<Config>): Promise<DbHandle> {
  const url = config?.url ?? process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const authToken = config?.authToken ?? process.env.DATABASE_AUTH_TOKEN;

  const client = createClient({ url, authToken, ...config });
  await client.execute('PRAGMA foreign_keys = ON');

  const db = drizzle(client, { schema });
  return { client, db };
}

/** Run pending migrations from the given folder. Fail hard on error (§3.4 step 2). */
export async function runMigrations(db: DB, migrationsFolder: string): Promise<void> {
  await migrate(db, { migrationsFolder });
}

export { schema };
