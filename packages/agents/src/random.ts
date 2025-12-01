/**
 * Random agent - picks a random legal action
 */

import type { Agent, DecideInput, DecideOutput, Rng } from "@cmax/core";
import { createRng } from "@cmax/core";

export interface RandomAgentConfig {
  seed?: string;
}

/**
 * Create a random agent that picks uniformly from legal actions
 * Uses deterministic RNG based on match ID and turn for reproducibility
 */
export function createRandomAgent(config: RandomAgentConfig = {}): Agent {
  const baseSeed = config.seed ?? "random-agent";

  return {
    id: "random",
    version: "1.0.0",
    displayName: "Random Agent",
    kind: "local",
    config,

    async decide(input: DecideInput): Promise<DecideOutput> {
      // Create deterministic RNG based on match context
      const seed = `${baseSeed}:${input.matchId}:${input.meta.turnIndex}`;
      const rng: Rng = createRng(seed);

      // Pick random action
      const action = rng.pick(input.legalActions);

      return {
        action,
        reason: "Randomly selected from legal actions",
      };
    },
  };
}

// Default instance
export const randomAgent = createRandomAgent();
