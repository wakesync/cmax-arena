/**
 * Kuhn Poker Rule Agent
 *
 * Implements a simple rule-based strategy for Kuhn Poker:
 * - King (3): Always bet/call (best hand)
 * - Queen (2): Check then fold, or check then call
 * - Jack (1): Always check, always fold to bets
 *
 * This approximates Nash equilibrium play without full game-theoretic calculation
 */

import type { Agent, DecideInput, DecideOutput, Rng } from "@cmax/core";
import { createRng } from "@cmax/core";
import type { KuhnObservation, KuhnAction } from "@cmax/games";

export interface KuhnRuleConfig {
  // Probability of bluffing with Jack when first to act (0-1)
  bluffFrequency?: number;
}

/**
 * Create a rule-based Kuhn Poker agent
 */
export function createKuhnRuleAgent(config: KuhnRuleConfig = {}): Agent {
  const bluffFreq = config.bluffFrequency ?? 0.33; // ~1/3 bluff rate approximates Nash

  return {
    id: "kuhn_rule",
    version: "1.0.0",
    displayName: "Kuhn Rule Agent",
    kind: "local",
    config,

    async decide(input: DecideInput): Promise<DecideOutput> {
      const obs = input.observation as KuhnObservation;
      const legalActions = input.legalActions as KuhnAction[];

      // Create RNG for mixed strategies
      const rng: Rng = createRng(`kuhn-rule:${input.matchId}:${input.meta.turnIndex}`);

      let action: KuhnAction;
      let reason: string;

      switch (obs.myCard) {
        case 3: // King - always bet/call (strongest hand)
          if (legalActions.includes("bet")) {
            action = "bet";
            reason = "King: betting for value";
          } else if (legalActions.includes("call")) {
            action = "call";
            reason = "King: calling with best hand";
          } else {
            action = "check";
            reason = "King: checking to trap";
          }
          break;

        case 2: // Queen - middle card, play cautiously
          if (legalActions.includes("check")) {
            action = "check";
            reason = "Queen: checking with medium hand";
          } else if (legalActions.includes("call")) {
            // Call about 1/3 of the time to prevent exploitation
            if (rng.nextFloat() < 0.33) {
              action = "call";
              reason = "Queen: calling to balance range";
            } else {
              action = "fold";
              reason = "Queen: folding to aggression";
            }
          } else {
            action = legalActions[0];
            reason = "Queen: default action";
          }
          break;

        case 1: // Jack - weakest hand
        default:
          if (legalActions.includes("check")) {
            // Bluff occasionally with Jack when first to act
            if (obs.history.length === 0 && rng.nextFloat() < bluffFreq) {
              action = "bet";
              reason = "Jack: bluffing as first action";
            } else {
              action = "check";
              reason = "Jack: checking with weak hand";
            }
          } else if (legalActions.includes("fold")) {
            action = "fold";
            reason = "Jack: folding weak hand";
          } else {
            action = legalActions[0];
            reason = "Jack: default action";
          }
          break;
      }

      return { action, reason };
    },
  };
}

// Default instance
export const kuhnRuleAgent = createKuhnRuleAgent();
