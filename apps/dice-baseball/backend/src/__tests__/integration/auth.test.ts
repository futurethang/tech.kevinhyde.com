import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server.js';
import {
  createTestToken,
  createExpiredToken,
  createInvalidToken,
  authHeader,
} from '../helpers/auth.js';

describe('Auth Middleware', () => {
  const app = createApp();
  const protectedEndpoint = '/api/protected';

  describe('with valid token', () => {
    it('accepts valid JWT and returns 200', async () => {
      const token = createTestToken();
      const response = await request(app)
        .get(protectedEndpoint)
        .set(authHeader(token));

      expect(response.status).toBe(200);
    });

    it('extracts user id from token', async () => {
      const token = createTestToken({ id: 'user-123' });
      const response = await request(app)
        .get(protectedEndpoint)
        .set(authHeader(token));

      expect(response.body.user.id).toBe('user-123');
    });

    it('extracts email from token', async () => {
      const token = createTestToken({ email: 'kevin@example.com' });
      const response = await request(app)
        .get(protectedEndpoint)
        .set(authHeader(token));

      expect(response.body.user.email).toBe('kevin@example.com');
    });

    it('extracts role from token if present', async () => {
      const token = createTestToken({ role: 'admin' });
      const response = await request(app)
        .get(protectedEndpoint)
        .set(authHeader(token));

      expect(response.body.user.role).toBe('admin');
    });
  });

  describe('with missing token', () => {
    it('returns 401 when no Authorization header', async () => {
      const response = await request(app).get(protectedEndpoint);
      expect(response.status).toBe(401);
    });

    it('returns unauthorized error message', async () => {
      const response = await request(app).get(protectedEndpoint);
      expect(response.body).toEqual({
        error: 'unauthorized',
        message: 'Missing authorization header',
      });
    });
  });

  describe('with invalid header format', () => {
    it('returns 401 for missing Bearer prefix', async () => {
      const token = createTestToken();
      const response = await request(app)
        .get(protectedEndpoint)
        .set('Authorization', token);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid authorization header format');
    });

    it('returns 401 for wrong prefix', async () => {
      const token = createTestToken();
      const response = await request(app)
        .get(protectedEndpoint)
        .set('Authorization', `Basic ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid authorization header format');
    });

    it('returns 401 for extra spaces in header', async () => {
      const token = createTestToken();
      const response = await request(app)
        .get(protectedEndpoint)
        .set('Authorization', `Bearer  ${token}`);

      expect(response.status).toBe(401);
    });
  });

  describe('with invalid token', () => {
    it('rejects token signed with wrong secret', async () => {
      const token = createInvalidToken();
      const response = await request(app)
        .get(protectedEndpoint)
        .set(authHeader(token));

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid token');
    });

    it('rejects malformed token', async () => {
      const response = await request(app)
        .get(protectedEndpoint)
        .set('Authorization', 'Bearer not-a-real-jwt');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid token');
    });

    it('rejects empty token', async () => {
      const response = await request(app)
        .get(protectedEndpoint)
        .set('Authorization', 'Bearer ');

      expect(response.status).toBe(401);
    });
  });

  describe('with expired token', () => {
    it('rejects expired JWT', async () => {
      const token = createExpiredToken();
      const response = await request(app)
        .get(protectedEndpoint)
        .set(authHeader(token));

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token has expired');
    });
  });
});
