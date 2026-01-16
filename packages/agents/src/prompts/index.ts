/**
 * Game-Specific Prompt Templates
 *
 * Export all game prompts for LLM agents.
 */

// Import prompts for use in registry
import { RPS_SYSTEM_PROMPT } from "./rps.js";
import { KUHN_POKER_SYSTEM_PROMPT } from "./kuhn-poker.js";
import { TEXAS_HOLDEM_SYSTEM_PROMPT } from "./texas-holdem.js";

// Rock-Paper-Scissors
export {
  RPS_SYSTEM_PROMPT,
  formatRPSObservation,
  parseRPSAction,
  analyzeOpponentPattern,
} from "./rps.js";
export type { RPSObservation } from "./rps.js";

// Kuhn Poker
export {
  KUHN_POKER_SYSTEM_PROMPT,
  formatKuhnObservation,
  parseKuhnAction,
  getNashStrategy,
} from "./kuhn-poker.js";
export type { KuhnPokerObservation } from "./kuhn-poker.js";

// Texas Hold'em
export {
  TEXAS_HOLDEM_SYSTEM_PROMPT,
  formatPokerObservation,
  parsePokerAction,
  estimateHandStrength,
} from "./texas-holdem.js";

/**
 * Registry of game prompts
 */
export const GAME_PROMPTS: Record<string, { systemPrompt: string }> = {
  rps: {
    systemPrompt: RPS_SYSTEM_PROMPT,
  },
  kuhn_poker: {
    systemPrompt: KUHN_POKER_SYSTEM_PROMPT,
  },
  texas_holdem: {
    systemPrompt: TEXAS_HOLDEM_SYSTEM_PROMPT,
  },
};

/**
 * Get the system prompt for a specific game
 */
export function getGameSystemPrompt(gameId: string): string | undefined {
  return GAME_PROMPTS[gameId]?.systemPrompt;
}
