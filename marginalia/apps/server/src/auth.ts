import { createMiddleware } from 'hono/factory';

/**
 * Single shared-secret auth (§3.8). Everything under /api requires
 * `Authorization: Bearer <APP_TOKEN>` except /api/healthz. No accounts, no OAuth —
 * boring and sufficient for a single user.
 */
export function bearerAuth(appToken: string) {
  if (!appToken) {
    throw new Error('APP_TOKEN is required to start the server (see .env.example)');
  }
  return createMiddleware(async (c, next) => {
    if (c.req.path === '/api/healthz') return next();

    const header = c.req.header('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

    // Constant-time-ish compare: length check then char compare.
    if (token.length !== appToken.length || token !== appToken) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    return next();
  });
}
