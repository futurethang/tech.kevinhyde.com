export interface SeededRng {
  currentState: () => number;
  next: () => number;
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function normalizeSeed(seed: string): number {
  const hashed = fnv1a32(seed.trim());
  // Avoid zero state for xorshift.
  return hashed === 0 ? 0x9e3779b9 : hashed;
}

export function createSeededRng(initialState: number): SeededRng {
  let state = initialState >>> 0;
  if (state === 0) {
    state = 0x9e3779b9;
  }

  const next = (): number => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };

  return {
    currentState: () => state,
    next,
  };
}
