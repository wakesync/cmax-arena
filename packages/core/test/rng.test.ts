import { describe, it, expect } from "vitest";
import { createRng } from "../src/rng.js";
import { sha256, commitSeed, verifySeed, hashObject } from "../src/crypto.js";

describe("RNG", () => {
  it("should produce deterministic results for same seed", () => {
    const rng1 = createRng("test-seed");
    const rng2 = createRng("test-seed");

    const values1 = Array.from({ length: 100 }, () => rng1.nextUint32());
    const values2 = Array.from({ length: 100 }, () => rng2.nextUint32());

    expect(values1).toEqual(values2);
  });

  it("should produce different results for different seeds", () => {
    const rng1 = createRng("seed-a");
    const rng2 = createRng("seed-b");

    const value1 = rng1.nextUint32();
    const value2 = rng2.nextUint32();

    expect(value1).not.toEqual(value2);
  });

  it("nextUint32 should return values in valid range", () => {
    const rng = createRng("range-test");

    for (let i = 0; i < 1000; i++) {
      const value = rng.nextUint32();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(0x100000000);
    }
  });

  it("nextFloat should return values in [0, 1)", () => {
    const rng = createRng("float-test");

    for (let i = 0; i < 1000; i++) {
      const value = rng.nextFloat();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("pick should return elements from array", () => {
    const rng = createRng("pick-test");
    const arr = ["a", "b", "c", "d", "e"];

    for (let i = 0; i < 100; i++) {
      const picked = rng.pick(arr);
      expect(arr).toContain(picked);
    }
  });

  it("pick should throw for empty array", () => {
    const rng = createRng("empty-test");
    expect(() => rng.pick([])).toThrow("Cannot pick from empty array");
  });

  it("shuffle should be deterministic", () => {
    const rng1 = createRng("shuffle-test");
    const rng2 = createRng("shuffle-test");

    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const shuffled1 = rng1.shuffle([...arr]);
    const shuffled2 = rng2.shuffle([...arr]);

    expect(shuffled1).toEqual(shuffled2);
  });

  it("shuffle should contain all original elements", () => {
    const rng = createRng("shuffle-complete");
    const arr = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle([...arr]);

    expect(shuffled.sort()).toEqual(arr.sort());
  });

  it("fork should create independent RNG", () => {
    const rng = createRng("parent");
    const forked = rng.fork("child");

    const parentValue = rng.nextUint32();
    const forkedValue = forked.nextUint32();

    expect(parentValue).not.toEqual(forkedValue);
  });

  it("fork should be deterministic", () => {
    const rng1 = createRng("parent");
    const rng2 = createRng("parent");

    const forked1 = rng1.fork("child");
    const forked2 = rng2.fork("child");

    expect(forked1.nextUint32()).toEqual(forked2.nextUint32());
  });
});

describe("Crypto", () => {
  it("sha256 should produce consistent hashes", () => {
    const hash1 = sha256("hello world");
    const hash2 = sha256("hello world");

    expect(hash1).toEqual(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("sha256 should produce different hashes for different inputs", () => {
    const hash1 = sha256("input1");
    const hash2 = sha256("input2");

    expect(hash1).not.toEqual(hash2);
  });

  it("commitSeed and verifySeed should work together", () => {
    const seed = "my-secret-seed";
    const commitment = commitSeed(seed);

    expect(verifySeed(seed, commitment)).toBe(true);
    expect(verifySeed("wrong-seed", commitment)).toBe(false);
  });

  it("hashObject should be deterministic regardless of key order", () => {
    const obj1 = { b: 2, a: 1 };
    const obj2 = { a: 1, b: 2 };

    expect(hashObject(obj1)).toEqual(hashObject(obj2));
  });
});
