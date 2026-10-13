/**
 * Seeded PRNG so a round resolves identically given the same state, the same
 * committed choices, and the same seed. Milestone 1's resolution is fully
 * deterministic and does not draw from this, but hazards and escape tests will,
 * so the plumbing is in place and carried through the round history.
 */

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Uniform pick; throws on an empty list. */
  pick<T>(items: readonly T[]): T;
  /** Current internal state — store it to replay from here. */
  readonly state: number;
}

/** mulberry32: small, fast, good enough for playtest statistics. */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const rng: Rng = {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(maxExclusive: number) {
      if (maxExclusive <= 0) throw new Error('maxExclusive must be positive');
      return Math.floor(rng.next() * maxExclusive);
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('cannot pick from an empty list');
      return items[rng.int(items.length)]!;
    },
    get state() {
      return s;
    },
  };
  return rng;
}
