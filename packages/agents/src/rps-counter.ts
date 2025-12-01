/**
 * RPS Counter Agent - learns opponent distribution and counters
 */

import type { Agent, DecideInput, DecideOutput } from "@cmax/core";
import type { RpsAction, RpsObservation } from "@cmax/games";

const ACTIONS: RpsAction[] = ["rock", "paper", "scissors"];

const COUNTERS: Record<RpsAction, RpsAction> = {
  rock: "paper",
  paper: "scissors",
  scissors: "rock",
};

/**
 * Agent that tracks opponent move distribution and plays the counter
 * to their most common move.
 */
export const rpsCounterAgent: Agent = {
  id: "rps_counter",
  version: "1.0.0",
  displayName: "RPS Counter Agent",
  kind: "local",

  async decide(input: DecideInput): Promise<DecideOutput> {
    const obs = input.observation as RpsObservation;

    // If no history, play random (rock)
    if (!obs.history || obs.history.length === 0) {
      return {
        action: "rock",
        reason: "No history, defaulting to rock",
      };
    }

    // Count opponent moves
    const counts: Record<RpsAction, number> = {
      rock: 0,
      paper: 0,
      scissors: 0,
    };

    for (const round of obs.history) {
      counts[round.opponentMove]++;
    }

    // Find most common opponent move
    let mostCommon: RpsAction = "rock";
    let maxCount = 0;

    for (const action of ACTIONS) {
      if (counts[action] > maxCount) {
        maxCount = counts[action];
        mostCommon = action;
      }
    }

    // Play the counter
    const action = COUNTERS[mostCommon];

    return {
      action,
      reason: `Opponent most common: ${mostCommon} (${maxCount}x), countering with ${action}`,
    };
  },
};
