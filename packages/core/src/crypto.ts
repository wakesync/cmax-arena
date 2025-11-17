/**
 * Cryptographic utilities for CMAX Arena
 * Uses Node.js crypto module for SHA256
 */

import { createHash } from "node:crypto";

/**
 * Compute SHA256 hash of a string
 * @param input UTF-8 string to hash
 * @returns Hex-encoded hash (64 characters)
 */
export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Commit-reveal helpers for seed verification
 */

/**
 * Create a commitment to a seed (reveals nothing about the seed)
 */
export function commitSeed(seed: string): string {
  return sha256(seed);
}

/**
 * Verify that a seed matches its commitment
 */
export function verifySeed(seed: string, commitment: string): boolean {
  return sha256(seed) === commitment;
}

/**
 * Hash an object for integrity checking
 * Objects are serialized with sorted keys for determinism
 */
export function hashObject(obj: unknown): string {
  const json = JSON.stringify(obj, Object.keys(obj as object).sort());
  return sha256(json);
}

/**
 * Generate a fingerprint for an agent configuration
 */
export function agentFingerprint(agent: {
  id: string;
  version: string;
  config?: unknown;
}): string {
  return sha256(
    JSON.stringify({
      id: agent.id,
      version: agent.version,
      config: agent.config,
    })
  );
}
