/**
 * Deterministic pseudo-random number generator using xorshift128+
 * Deterministic across all platforms and Node.js versions
 */

import { sha256 } from "./crypto.js";

export interface Rng {
  nextUint32(): number;
  nextFloat(): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: T[]): T[];
  fork(label: string): Rng;
}

// Internal state for xorshift128+
interface XorshiftState {
  s0: bigint;
  s1: bigint;
}

function xorshift128plus(state: XorshiftState): [number, XorshiftState] {
  let s1 = state.s0;
  const s0 = state.s1;

  // xorshift128+ algorithm
  s1 ^= s1 << 23n;
  s1 ^= s1 >> 18n;
  s1 ^= s0;
  s1 ^= s0 >> 5n;

  const result = (s0 + s1) & 0xffffffffn;

  return [Number(result), { s0, s1 }];
}

function seedToState(seed: string): XorshiftState {
  // Hash the seed to get deterministic initial state
  const hash = sha256(seed);

  // Use first 16 bytes for s0, next 16 bytes for s1
  const s0 = BigInt("0x" + hash.slice(0, 16));
  const s1 = BigInt("0x" + hash.slice(16, 32));

  // Ensure non-zero state (xorshift requires at least one non-zero)
  return {
    s0: s0 || 1n,
    s1: s1 || 1n,
  };
}

class XorshiftRng implements Rng {
  private state: XorshiftState;
  private seed: string;

  constructor(seed: string) {
    this.seed = seed;
    this.state = seedToState(seed);
  }

  nextUint32(): number {
    const [value, newState] = xorshift128plus(this.state);
    this.state = newState;
    return value >>> 0; // Ensure unsigned
  }

  nextFloat(): number {
    // Generate float in [0, 1) with 32 bits of precision
    return this.nextUint32() / 0x100000000;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) {
      throw new Error("Cannot pick from empty array");
    }
    const index = Math.floor(this.nextFloat() * arr.length);
    return arr[index];
  }

  shuffle<T>(arr: T[]): T[] {
    // Fisher-Yates shuffle
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.nextFloat() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  fork(label: string): Rng {
    // Create a new RNG with a derived seed
    return new XorshiftRng(`${this.seed}:${label}`);
  }
}

/**
 * Create a new deterministic RNG from a seed string
 */
export function createRng(seed: string): Rng {
  return new XorshiftRng(seed);
}
