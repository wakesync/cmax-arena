/**
 * Texas Hold'em LLM Prompts
 *
 * Game-specific prompts for LLM agents playing Texas Hold'em poker.
 */

import type { HoldemObservation, Card } from "@cmax/games";

export const TEXAS_HOLDEM_SYSTEM_PROMPT = `You are an expert poker player competing in a Texas Hold'em tournament. Make optimal decisions based on:
- Hand strength and potential
- Pot odds and implied odds
- Position relative to dealer
- Stack sizes and bet sizing
- Opponent tendencies and bet patterns

HAND RANKINGS (strongest to weakest):
1. Royal Flush (A-K-Q-J-10 same suit)
2. Straight Flush (five consecutive cards, same suit)
3. Four of a Kind (four cards of same rank)
4. Full House (three of a kind + pair)
5. Flush (five cards same suit)
6. Straight (five consecutive cards)
7. Three of a Kind
8. Two Pair
9. One Pair
10. High Card

POSITION NOTES:
- Early position: play tight, premium hands only
- Middle position: slightly wider range
- Late position: can play more hands, steal blinds
- Button: best position, act last post-flop

BETTING STRATEGY:
- Value bet with strong hands
- Bluff selectively with good blockers
- Consider pot odds when calling
- Fold weak hands to heavy aggression

Respond with EXACTLY one of these actions (nothing else):
- FOLD
- CHECK
- CALL
- RAISE <amount>
- ALL_IN`;

const SUIT_SYMBOLS: Record<string, string> = {
  h: "\u2665",
  d: "\u2666",
  c: "\u2663",
  s: "\u2660",
};

/**
 * Format a card for display
 */
function formatCard(card: Card): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit] || card.suit}`;
}

/**
 * Format cards array for display
 */
function formatCards(cards: Card[]): string {
  if (cards.length === 0) return "None yet";
  return cards.map(formatCard).join(" ");
}

/**
 * Format a Texas Hold'em observation into a prompt for the LLM
 */
export function formatPokerObservation(obs: HoldemObservation): string {
  const hand = obs.hand ? formatCards(obs.hand) : "Unknown";
  const community = formatCards(obs.communityCards);

  const opponents = obs.opponents
    .map((o) => {
      let status = "";
      if (o.folded) status = " (folded)";
      else if (o.allIn) status = " (all-in)";
      return `  - Player ${o.playerId}: ${o.chips} chips, bet ${o.bet}${status}`;
    })
    .join("\n");

  let actions = "FOLD";
  if (obs.toCall === 0) {
    actions += ", CHECK";
  } else {
    actions += `, CALL (${obs.toCall})`;
  }
  actions += `, RAISE (min: ${obs.minRaise})`;
  actions += ", ALL_IN";

  return `CURRENT SITUATION:
- Your hand: ${hand}
- Community cards: ${community}
- Pot: ${obs.pot} chips
- Your chips: ${obs.myChips}
- Your current bet: ${obs.myBet}
- Amount to call: ${obs.toCall}
- Minimum raise: ${obs.minRaise}
- Betting round: ${obs.round.toUpperCase()}
- Your position: ${getPositionDescription(obs)}

OPPONENTS:
${opponents}

LEGAL ACTIONS: ${actions}

Choose your action:`;
}

/**
 * Get position description based on dealer button
 */
function getPositionDescription(obs: HoldemObservation): string {
  const numPlayers = obs.opponents.length + 1;
  const relativePosition = (obs.playerId - obs.dealerIndex + numPlayers) % numPlayers;

  if (numPlayers === 2) {
    return relativePosition === 0 ? "Button/Small Blind" : "Big Blind";
  }

  switch (relativePosition) {
    case 0:
      return "Button (BTN)";
    case 1:
      return "Small Blind (SB)";
    case 2:
      return "Big Blind (BB)";
    case 3:
      return "Under the Gun (UTG)";
    default:
      if (relativePosition >= numPlayers - 2) {
        return "Late Position (CO/HJ)";
      }
      return "Middle Position (MP)";
  }
}

/**
 * Parse LLM response to extract poker action
 */
export function parsePokerAction(
  response: string,
  obs: HoldemObservation
): string {
  const normalized = response.trim().toUpperCase();

  // Check for simple actions
  if (normalized === "FOLD") return "fold";
  if (normalized === "CHECK") return "check";
  if (normalized === "CALL") return "call";
  if (normalized === "ALL_IN" || normalized === "ALLIN" || normalized === "ALL-IN") {
    return "all_in";
  }

  // Parse RAISE <amount>
  const raiseMatch = normalized.match(/RAISE\s*(\d+)/);
  if (raiseMatch) {
    const amount = parseInt(raiseMatch[1], 10);
    const clampedAmount = Math.max(amount, obs.minRaise);
    return `raise_${clampedAmount}`;
  }

  // If just "RAISE" without amount, use minimum
  if (normalized.startsWith("RAISE")) {
    return `raise_${obs.minRaise}`;
  }

  // Default to fold if unparseable
  console.warn(`Could not parse poker action: "${response}", defaulting to fold`);
  return "fold";
}

/**
 * Estimate hand strength (simplified)
 */
export function estimateHandStrength(
  hand: [Card, Card],
  communityCards: Card[]
): string {
  // Pre-flop evaluation
  if (communityCards.length === 0) {
    const [c1, c2] = hand;
    const isPair = c1.rank === c2.rank;
    const isSuited = c1.suit === c2.suit;

    const rankValue1 = "23456789TJQKA".indexOf(c1.rank);
    const rankValue2 = "23456789TJQKA".indexOf(c2.rank);
    const highRank = Math.max(rankValue1, rankValue2);
    const lowRank = Math.min(rankValue1, rankValue2);
    const gap = highRank - lowRank;

    // Premium pairs
    if (isPair && highRank >= 10) return "Premium (high pair)";
    if (isPair && highRank >= 7) return "Strong (medium pair)";
    if (isPair) return "Playable (low pair)";

    // Big cards
    if (highRank >= 11 && lowRank >= 10) {
      return isSuited ? "Premium (big suited)" : "Strong (big cards)";
    }

    // Suited connectors
    if (isSuited && gap <= 2 && lowRank >= 6) {
      return "Playable (suited connector)";
    }

    // Suited aces
    if (isSuited && (c1.rank === "A" || c2.rank === "A")) {
      return "Playable (suited ace)";
    }

    // High cards
    if (highRank >= 10 && lowRank >= 8) {
      return "Marginal (high cards)";
    }

    return "Weak (fold candidate)";
  }

  // Post-flop - simplified
  return "Evaluate based on board texture";
}
