/**
 * Minimal runtime validation primitives.
 *
 * Hand-written rather than pulled from a schema library: the config shapes are
 * few and stable, and this keeps the dependency list at vite/ts/vitest/phaser.
 * Every failure carries the JSON path that caused it, so a bad map file points
 * at the offending hex instead of failing silently.
 */

export class ConfigError extends Error {
  constructor(
    message: string,
    readonly path: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'ConfigError';
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function obj(v: unknown, path: string): Record<string, unknown> {
  if (!isRecord(v)) throw new ConfigError('expected an object', path);
  return v;
}

export function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) throw new ConfigError('expected an array', path);
  return v;
}

export function str(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.length === 0) {
    throw new ConfigError('expected a non-empty string', path);
  }
  return v;
}

export function optStr(v: unknown, path: string): string | undefined {
  return v === undefined ? undefined : str(v, path);
}

export function num(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new ConfigError('expected a finite number', path);
  }
  return v;
}

export function int(v: unknown, path: string): number {
  const n = num(v, path);
  if (!Number.isInteger(n)) throw new ConfigError('expected an integer', path);
  return n;
}

export function bool(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') throw new ConfigError('expected a boolean', path);
  return v;
}

export function optBool(v: unknown, path: string, fallback: boolean): boolean {
  return v === undefined ? fallback : bool(v, path);
}

export function oneOf<T extends string>(v: unknown, path: string, allowed: readonly T[]): T {
  const s = str(v, path);
  if (!(allowed as readonly string[]).includes(s)) {
    throw new ConfigError(`expected one of ${allowed.join(' | ')}, got "${s}"`, path);
  }
  return s as T;
}

export function strArray(v: unknown, path: string): string[] {
  return arr(v, path).map((item, i) => str(item, `${path}[${i}]`));
}

/** Builds an id -> value index, rejecting duplicates. */
export function indexById<T extends { id: string }>(
  items: readonly T[],
  path: string,
): Map<string, T> {
  const out = new Map<string, T>();
  items.forEach((item, i) => {
    if (out.has(item.id)) throw new ConfigError(`duplicate id "${item.id}"`, `${path}[${i}]`);
    out.set(item.id, item);
  });
  return out;
}

/** Asserts a referenced id exists, with a message naming both sides. */
export function requireRef(
  known: ReadonlySet<string> | ReadonlyMap<string, unknown>,
  id: string,
  what: string,
  path: string,
): void {
  const has = known instanceof Set ? known.has(id) : (known as ReadonlyMap<string, unknown>).has(id);
  if (!has) throw new ConfigError(`unknown ${what} "${id}"`, path);
}
