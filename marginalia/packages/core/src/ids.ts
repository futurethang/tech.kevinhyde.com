import { ulid } from 'ulid';

/**
 * Every entity gets a ULID text primary key (§3.3): portable, lexicographically
 * sortable by creation time, and sync-friendly. Use this everywhere instead of
 * autoincrement integers.
 */
export function newId(): string {
  return ulid();
}
