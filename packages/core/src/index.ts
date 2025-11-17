// @cmax/core - CMAX Arena Core Framework

export const VERSION = "0.1.0";

// RNG
export { createRng } from "./rng.js";
export type { Rng } from "./rng.js";

// Crypto
export {
  sha256,
  commitSeed,
  verifySeed,
  hashObject,
  agentFingerprint,
} from "./crypto.js";
