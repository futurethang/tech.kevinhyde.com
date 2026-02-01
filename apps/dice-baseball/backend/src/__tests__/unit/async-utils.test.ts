/**
 * Async Utilities Tests
 * TDD for retry logic, operation results, and error handling patterns
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  asyncWithRetry,
  createOperationResult,
  OperationError,
  isRetriableError,
  calculateBackoff,
} from '../../utils/async-utils';

describe('asyncWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('successful operations', () => {
    it('returns result on first attempt success', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const resultPromise = asyncWithRetry(operation);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.meta.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('includes operation metadata', async () => {
      const operation = vi.fn().mockResolvedValue('data');

      const resultPromise = asyncWithRetry(operation, { operationId: 'test-op' });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.meta.operationId).toBe('test-op');
      expect(result.meta.duration).toBeGreaterThanOrEqual(0);
    });

    it('generates operationId if not provided', async () => {
      const operation = vi.fn().mockResolvedValue('data');

      const resultPromise = asyncWithRetry(operation);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.meta.operationId).toBeDefined();
      expect(result.meta.operationId.length).toBeGreaterThan(0);
    });
  });

  describe('retry behavior', () => {
    it('retries on retriable error', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new OperationError('network', 'Network error', true))
        .mockResolvedValue('success');

      const resultPromise = asyncWithRetry(operation, { maxRetries: 3 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.meta.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('does not retry on non-retriable error', async () => {
      const operation = vi
        .fn()
        .mockRejectedValue(new OperationError('validation', 'Invalid input', false));

      const resultPromise = asyncWithRetry(operation, { maxRetries: 3 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.meta.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('respects maxRetries limit', async () => {
      const operation = vi
        .fn()
        .mockRejectedValue(new OperationError('network', 'Network error', true));

      const resultPromise = asyncWithRetry(operation, { maxRetries: 3 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.meta.attempts).toBe(4); // 1 initial + 3 retries
      expect(operation).toHaveBeenCalledTimes(4);
    });

    it('uses exponential backoff between retries', async () => {
      const delays: number[] = [];
      const originalSetTimeout = globalThis.setTimeout;

      vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, delay) => {
        if (delay && delay > 0) delays.push(delay as number);
        return originalSetTimeout(fn, 0);
      });

      const operation = vi
        .fn()
        .mockRejectedValueOnce(new OperationError('network', 'error', true))
        .mockRejectedValueOnce(new OperationError('network', 'error', true))
        .mockResolvedValue('success');

      const resultPromise = asyncWithRetry(operation, {
        maxRetries: 3,
        baseDelayMs: 100,
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      // Should have increasing delays: 100, 200, ...
      expect(delays.length).toBe(2);
      expect(delays[1]).toBeGreaterThan(delays[0]);

      vi.restoreAllMocks();
    });
  });

  describe('error handling', () => {
    it('wraps unknown errors as OperationError', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Unknown error'));

      const resultPromise = asyncWithRetry(operation);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('unknown_error');
      expect(result.error?.message).toBe('Unknown error');
    });

    it('includes retryAfter for retriable errors', async () => {
      const operation = vi
        .fn()
        .mockRejectedValue(new OperationError('rate_limit', 'Too many requests', true));

      const resultPromise = asyncWithRetry(operation, { maxRetries: 0 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.error?.retriable).toBe(true);
      expect(result.error?.retryAfter).toBeDefined();
    });

    it('calls onRetry callback when retrying', async () => {
      const onRetry = vi.fn();
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new OperationError('network', 'error', true))
        .mockResolvedValue('success');

      const resultPromise = asyncWithRetry(operation, { maxRetries: 3, onRetry });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.objectContaining({ attempt: 1, error: expect.any(OperationError) })
      );
    });
  });

  describe('timeout handling', () => {
    it('aborts operation on timeout', async () => {
      // Use real timers for this test - fake timers don't work well with Promise.race
      vi.useRealTimers();

      const operation = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000))
      );

      const result = await asyncWithRetry(operation, { timeoutMs: 50, maxRetries: 0 });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('timeout');

      // Restore fake timers for other tests
      vi.useFakeTimers();
    }, 10000);
  });
});

describe('createOperationResult', () => {
  it('creates success result', () => {
    const result = createOperationResult({
      success: true,
      data: { id: 1 },
      operationId: 'op-1',
      attempts: 1,
      duration: 50,
    });

    expect(result).toEqual({
      success: true,
      data: { id: 1 },
      meta: {
        operationId: 'op-1',
        attempts: 1,
        duration: 50,
      },
    });
  });

  it('creates error result', () => {
    const result = createOperationResult({
      success: false,
      error: {
        code: 'not_found',
        message: 'Resource not found',
        retriable: false,
      },
      operationId: 'op-2',
      attempts: 1,
      duration: 30,
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: 'not_found',
        message: 'Resource not found',
        retriable: false,
      },
      meta: {
        operationId: 'op-2',
        attempts: 1,
        duration: 30,
      },
    });
  });
});

describe('OperationError', () => {
  it('creates retriable error', () => {
    const error = new OperationError('network_error', 'Connection failed', true);

    expect(error.code).toBe('network_error');
    expect(error.message).toBe('Connection failed');
    expect(error.retriable).toBe(true);
    expect(error.name).toBe('OperationError');
  });

  it('creates non-retriable error', () => {
    const error = new OperationError('validation_error', 'Invalid input', false);

    expect(error.retriable).toBe(false);
  });

  it('includes optional details', () => {
    const error = new OperationError('validation_error', 'Invalid', false, {
      field: 'email',
    });

    expect(error.details).toEqual({ field: 'email' });
  });
});

describe('isRetriableError', () => {
  it('returns true for OperationError with retriable flag', () => {
    const error = new OperationError('network', 'error', true);
    expect(isRetriableError(error)).toBe(true);
  });

  it('returns false for OperationError without retriable flag', () => {
    const error = new OperationError('validation', 'error', false);
    expect(isRetriableError(error)).toBe(false);
  });

  it('returns true for network-related errors', () => {
    const errors = [
      new Error('ECONNREFUSED'),
      new Error('ETIMEDOUT'),
      new Error('ENOTFOUND'),
      new Error('fetch failed'),
    ];

    errors.forEach((error) => {
      expect(isRetriableError(error)).toBe(true);
    });
  });

  it('returns false for unknown errors', () => {
    expect(isRetriableError(new Error('Something went wrong'))).toBe(false);
  });
});

describe('calculateBackoff', () => {
  it('calculates exponential backoff', () => {
    expect(calculateBackoff(0, 100)).toBe(100);
    expect(calculateBackoff(1, 100)).toBe(200);
    expect(calculateBackoff(2, 100)).toBe(400);
    expect(calculateBackoff(3, 100)).toBe(800);
  });

  it('respects max delay', () => {
    expect(calculateBackoff(10, 100, 1000)).toBe(1000);
  });

  it('adds jitter when enabled', () => {
    const results = new Set<number>();
    for (let i = 0; i < 10; i++) {
      results.add(calculateBackoff(1, 100, 10000, true));
    }
    // With jitter, we should get some variation
    expect(results.size).toBeGreaterThan(1);
  });
});
