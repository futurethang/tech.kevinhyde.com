/**
 * Async Utilities - Dice Baseball V2
 * Retry logic, operation results, and error handling patterns for Phase 5+
 *
 * Features:
 * - Configurable retry with exponential backoff
 * - Typed operation results with metadata
 * - Circuit breaker support (future)
 * - Frontend-friendly error format
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================
// TYPES
// ============================================

export interface OperationResultMeta {
  operationId: string;
  duration: number;
  attempts: number;
}

export interface OperationErrorData {
  code: string;
  message: string;
  retriable: boolean;
  retryAfter?: number;
  details?: Record<string, unknown>;
}

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: OperationErrorData;
  meta: OperationResultMeta;
}

export interface RetryOptions {
  operationId?: string;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  jitter?: boolean;
  onRetry?: (info: { attempt: number; error: Error; nextDelayMs: number }) => void;
}

export interface CreateResultOptions<T> {
  success: boolean;
  data?: T;
  error?: OperationErrorData;
  operationId: string;
  attempts: number;
  duration: number;
}

// ============================================
// ERROR CLASS
// ============================================

/**
 * Custom error class for operation errors with retry semantics
 */
export class OperationError extends Error {
  public readonly code: string;
  public readonly retriable: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    retriable: boolean,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OperationError';
    this.code = code;
    this.retriable = retriable;
    this.details = details;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OperationError);
    }
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculates exponential backoff delay with optional jitter
 */
export function calculateBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number = 30000,
  jitter: boolean = false
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  if (jitter) {
    // Add random jitter: 0.5x to 1.5x the delay
    const jitterMultiplier = 0.5 + Math.random();
    return Math.floor(cappedDelay * jitterMultiplier);
  }

  return cappedDelay;
}

/**
 * Determines if an error is retriable based on error type
 */
export function isRetriableError(error: unknown): boolean {
  // OperationError with explicit retriable flag
  if (error instanceof OperationError) {
    return error.retriable;
  }

  // Standard network-related errors
  if (error instanceof Error) {
    const retriablePatterns = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      'EAI_AGAIN',
      'fetch failed',
      'network',
    ];

    const message = error.message.toLowerCase();
    return retriablePatterns.some(
      (pattern) =>
        message.includes(pattern.toLowerCase()) || error.message.includes(pattern)
    );
  }

  return false;
}

/**
 * Creates a standardized operation result
 */
export function createOperationResult<T>(options: CreateResultOptions<T>): OperationResult<T> {
  const result: OperationResult<T> = {
    success: options.success,
    meta: {
      operationId: options.operationId,
      attempts: options.attempts,
      duration: options.duration,
    },
  };

  if (options.success && options.data !== undefined) {
    result.data = options.data;
  }

  if (!options.success && options.error) {
    result.error = options.error;
  }

  return result;
}

/**
 * Delays execution for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a timeout promise that rejects after specified milliseconds
 */
function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () => reject(new OperationError('timeout', `Operation timed out after ${ms}ms`, true)),
      ms
    )
  );
}

// ============================================
// MAIN RETRY FUNCTION
// ============================================

/**
 * Executes an async operation with retry logic and returns standardized result
 *
 * Features:
 * - Exponential backoff between retries
 * - Configurable max retries
 * - Optional timeout per attempt
 * - Retry callback for monitoring
 * - Returns OperationResult with metadata
 *
 * @example
 * const result = await asyncWithRetry(
 *   () => fetchGameState(gameId),
 *   { maxRetries: 3, baseDelayMs: 1000 }
 * );
 *
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 */
export async function asyncWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<OperationResult<T>> {
  const {
    operationId = uuidv4(),
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    timeoutMs,
    jitter = true,
    onRetry,
  } = options;

  const startTime = Date.now();
  let attempts = 0;
  let lastError: Error | undefined;

  while (attempts <= maxRetries) {
    attempts++;

    try {
      // Execute operation with optional timeout
      let result: T;

      if (timeoutMs) {
        result = await Promise.race([operation(), createTimeout(timeoutMs)]);
      } else {
        result = await operation();
      }

      return createOperationResult({
        success: true,
        data: result,
        operationId,
        attempts,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Determine if we should retry
      const shouldRetry = isRetriableError(error) && attempts <= maxRetries;

      if (!shouldRetry) {
        // Non-retriable error or max retries exceeded
        break;
      }

      // Calculate delay before next retry
      const delayMs = calculateBackoff(attempts - 1, baseDelayMs, maxDelayMs, jitter);

      // Call retry callback if provided
      if (onRetry) {
        onRetry({
          attempt: attempts,
          error: lastError,
          nextDelayMs: delayMs,
        });
      }

      // Wait before retrying
      await delay(delayMs);
    }
  }

  // All retries exhausted or non-retriable error
  const errorData: OperationErrorData = lastError instanceof OperationError
    ? {
        code: lastError.code,
        message: lastError.message,
        retriable: lastError.retriable,
        retryAfter: lastError.retriable ? calculateBackoff(attempts, baseDelayMs, maxDelayMs) : undefined,
        details: lastError.details,
      }
    : {
        code: 'unknown_error',
        message: lastError?.message || 'Unknown error occurred',
        retriable: false,
      };

  return createOperationResult({
    success: false,
    error: errorData,
    operationId,
    attempts,
    duration: Date.now() - startTime,
  });
}

// ============================================
// COMMON ERROR FACTORIES
// ============================================

/**
 * Factory functions for common error types
 * Provides consistent error codes for frontend handling
 */
export const Errors = {
  network: (message: string = 'Network error') =>
    new OperationError('network_error', message, true),

  timeout: (message: string = 'Operation timed out') =>
    new OperationError('timeout', message, true),

  rateLimit: (retryAfterSeconds?: number) =>
    new OperationError(
      'rate_limit',
      `Too many requests${retryAfterSeconds ? `. Retry after ${retryAfterSeconds}s` : ''}`,
      true,
      retryAfterSeconds ? { retryAfterSeconds } : undefined
    ),

  validation: (message: string, details?: Record<string, unknown>) =>
    new OperationError('validation_error', message, false, details),

  notFound: (resource: string) =>
    new OperationError('not_found', `${resource} not found`, false),

  forbidden: (message: string = 'Access denied') =>
    new OperationError('forbidden', message, false),

  conflict: (message: string) =>
    new OperationError('conflict', message, false),

  serverError: (message: string = 'Internal server error') =>
    new OperationError('server_error', message, true),
} as const;
