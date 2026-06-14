import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit config (§3.1). dialect 'turso' is the libSQL driver — works against a
 * local `file:` DB now and a managed Turso URL later (the escape hatch), unchanged.
 * `generate` emits plain, reviewable .sql into ./drizzle (the "no painful migrations"
 * constraint). Migrations are applied at runtime via runMigrations() in db.ts.
 */
export default defineConfig({
  dialect: 'turso',
  schema: './packages/core/src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./data/app.db',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
  verbose: true,
  strict: true,
});
