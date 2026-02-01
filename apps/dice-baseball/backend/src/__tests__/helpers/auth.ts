import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../../types/index.js';

const TEST_SECRET = 'test-secret-key-for-testing-only';

export interface TestUserOptions {
  id?: string;
  email?: string;
  role?: string;
  expiresIn?: string | number;
}

/**
 * Create a valid JWT token for testing
 */
export function createTestToken(options: TestUserOptions = {}): string {
  const payload: JWTPayload = {
    sub: options.id || 'test-user-id',
    email: options.email || 'test@example.com',
    role: options.role,
  };

  return jwt.sign(payload, TEST_SECRET, {
    expiresIn: options.expiresIn || '1h',
  });
}

/**
 * Create an expired JWT token for testing
 */
export function createExpiredToken(options: TestUserOptions = {}): string {
  const payload: JWTPayload = {
    sub: options.id || 'test-user-id',
    email: options.email || 'test@example.com',
    role: options.role,
  };

  return jwt.sign(payload, TEST_SECRET, {
    expiresIn: '-1h', // Already expired
  });
}

/**
 * Create an invalid JWT token (signed with wrong secret)
 */
export function createInvalidToken(options: TestUserOptions = {}): string {
  const payload: JWTPayload = {
    sub: options.id || 'test-user-id',
    email: options.email || 'test@example.com',
    role: options.role,
  };

  return jwt.sign(payload, 'wrong-secret-key', {
    expiresIn: '1h',
  });
}

/**
 * Create authorization header with Bearer token
 */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
