/**
 * Kuhn Poker LLM Prompts
 *
 * Game-specific prompts for LLM agents playing Kuhn Poker.
 */

export interface KuhnPokerObservation {
  card: string; // "J", "Q", or "K"
  pot: number;
  myBet: number;
  opponentBet: number;
  bettingHistory: string[];
  isFirstToAct: boolean;
  handNumber?: number;
}

export const KUHN_POKER_SYSTEM_PROMPT = `You are playing Kuhn Poker, a simplified poker variant used in game theory research.

GAME RULES:
- 3-card deck: Jack (J), Queen (Q), King (K)
- Each player antes 1 chip, then receives one card
- King beats Queen beats Jack
- Betting round: check/bet, then call/fold
- Winner takes the pot

OPTIMAL STRATEGY (Nash Equilibrium approximation):
- KING: Always bet/call (you have the nuts or a strong bluff-catcher)
- QUEEN: Check/call cautiously (medium strength, trap or fold to aggression)
- JACK: Mostly fold to bets, occasionally bluff (~1/3 of the time when first to act)

BETTING OPTIONS:
- check: Pass the action (only if no bet to you)
- bet: Put 1 chip in (if no bet yet)
- call: Match opponent's bet
- fold: Give up the hand

Respond with EXACTLY one action: check, bet, call, or fold`;

/**
 * Format a Kuhn Poker observation into a prompt for the LLM
 */
export function formatKuhnObservation(obs: KuhnPokerObservation): string {
  const cardDescription = {
    K: "King (highest)",
    Q: "Queen (middle)",
    J: "Jack (lowest)",
  }[obs.card] || obs.card;

  const historyText = obs.bettingHistory.length > 0
    ? obs.bettingHistory.join(" → ")
    : "No actions yet";

  const position = obs.isFirstToAct ? "First to act" : "Second to act";

  // Determine available actions based on state
  let availableActions: string;
  const opponentHasBet = obs.opponentBet > obs.myBet;

  if (opponentHasBet) {
    availableActions = "CALL or FOLD";
  } else if (obs.bettingHistory.length === 0) {
    availableActions = "CHECK or BET";
  } else {
    availableActions = "CHECK or BET";
  }

  // Strategy hint based on card
  const strategyHint = getStrategyHint(obs.card, opponentHasBet, obs.isFirstToAct);

  return `CURRENT HAND:
- Your card: ${cardDescription}
- Pot: ${obs.pot} chips
- Your bet: ${obs.myBet}
- Opponent bet: ${obs.opponentBet}
- Position: ${position}
- Betting history: ${historyText}

AVAILABLE ACTIONS: ${availableActions}

${strategyHint}

Choose your action:`;
}

/**
 * Get strategy hint based on card and situation
 */
function getStrategyHint(card: string, opponentBet: boolean, isFirst: boolean): string {
  if (card === "K") {
    if (opponentBet) {
      return "Strategy hint: You have the King - always call.";
    }
    return "Strategy hint: You have the King - bet for value.";
  }

  if (card === "Q") {
    if (opponentBet) {
      return "Strategy hint: Queen facing a bet is tricky. Consider if opponent would bluff with Jack.";
    }
    return "Strategy hint: Queen is medium strength. Check to control pot size.";
  }

  if (card === "J") {
    if (opponentBet) {
      return "Strategy hint: Jack is weakest - usually fold to bets unless you're committed.";
    }
    if (isFirst) {
      return "Strategy hint: Jack as first to act - check usually, occasional bluff bet (~1/3).";
    }
    return "Strategy hint: Jack in position - check behind.";
  }

  return "";
}

/**
 * Parse LLM response to extract Kuhn Poker action
 */
export function parseKuhnAction(
  response: string,
  legalActions: string[]
): string | null {
  const normalized = response.trim().toLowerCase();

  // Direct matches
  for (const action of legalActions) {
    if (normalized === action.toLowerCase()) {
      return action;
    }
  }

  // Partial matches
  if (normalized.includes("fold")) return "fold";
  if (normalized.includes("call")) return "call";
  if (normalized.includes("bet")) return "bet";
  if (normalized.includes("check")) return "check";

  return null;
}

/**
 * Get Nash equilibrium probabilities for Kuhn Poker
 * Based on the famous game theory solution
 */
export function getNashStrategy(
  card: string,
  isFirstToAct: boolean,
  opponentBet: boolean
): { action: string; probability: number }[] {
  // Simplified Nash equilibrium strategies

  if (card === "K") {
    // King: Always bet/call
    return opponentBet
      ? [{ action: "call", probability: 1.0 }]
      : [{ action: "bet", probability: 1.0 }];
  }

  if (card === "Q") {
    // Queen: Mixed strategy
    if (opponentBet) {
      // Call about 1/3 of the time (indifferent vs optimal bluff)
      return [
        { action: "call", probability: 0.33 },
        { action: "fold", probability: 0.67 },
      ];
    }
    // Check always when first
    return [{ action: "check", probability: 1.0 }];
  }

  if (card === "J") {
    // Jack: Bluff 1/3 when first, fold to bets
    if (opponentBet) {
      return [{ action: "fold", probability: 1.0 }];
    }
    if (isFirstToAct) {
      return [
        { action: "bet", probability: 0.33 },
        { action: "check", probability: 0.67 },
      ];
    }
    return [{ action: "check", probability: 1.0 }];
  }

  return [{ action: "check", probability: 1.0 }];
}
