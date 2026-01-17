/**
 * Texas Hold'em LLM Prompts
 *
 * Game-specific prompts for LLM agents playing Texas Hold'em poker.
 */

import type { TexasHoldemObservation, Card, PositionName } from "@cmax/games";

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
- Early position (UTG): play tight, premium hands only
- Middle position (MP): slightly wider range
- Late position (CO, BTN): can play more hands, steal blinds
- Button: best position, act last post-flop
- Blinds (SB, BB): already invested, defend reasonably

BETTING STRATEGY:
- Value bet with strong hands
- Bluff selectively with good blockers
- Consider pot odds when calling
- Fold weak hands to heavy aggression
- Size bets appropriately for value/protection

Respond with EXACTLY one of these actions (nothing else):
- fold
- check
- call
- bet <amount>
- raise <amount>
- all_in`;

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
  if (!cards || cards.length === 0) return "None yet";
  return cards.map(formatCard).join(" ");
}

/**
 * Get position description
 */
function getPositionDescription(position: PositionName): string {
  const descriptions: Record<PositionName, string> = {
    'BTN': 'Button (best position, act last post-flop)',
    'SB': 'Small Blind (out of position)',
    'BB': 'Big Blind (defend your investment)',
    'UTG': 'Under the Gun (first to act, play tight)',
    'UTG+1': 'UTG+1 (early position)',
    'MP': 'Middle Position (balanced range)',
    'MP+1': 'Middle Position+1',
    'HJ': 'Hijack (late-middle position)',
    'CO': 'Cutoff (steal position)',
  };
  return descriptions[position] || position;
}

/**
 * Calculate pot odds
 */
function calculatePotOdds(toCall: number, pot: number): string {
  if (toCall === 0) return "N/A (no bet to call)";
  const odds = toCall / (pot + toCall);
  const percentage = (odds * 100).toFixed(1);
  const ratio = ((1 / odds) - 1).toFixed(1);
  return `${percentage}% (need ${percentage}% equity to call profitably, ${ratio}:1)`;
}

/**
 * Format a Texas Hold'em observation into a prompt for the LLM
 */
export function formatPokerObservation(obs: TexasHoldemObservation): string {
  const hand = obs.holeCards ? formatCards(obs.holeCards) : "Unknown";
  const community = formatCards(obs.communityCards);
  const toCall = obs.currentBetToCall - obs.currentBet;

  const opponents = obs.opponents
    .map((o) => {
      let status = "";
      if (o.status === 'folded') status = " (folded)";
      else if (o.status === 'all_in') status = " (all-in)";
      return `  - ${o.position}: ${o.chips} chips, bet ${o.currentBet}${status}`;
    })
    .join("\n");

  // Build legal actions string
  const legalActionsStr = obs.legalActions
    .map(la => {
      if (la.type === 'bet' || la.type === 'raise') {
        return `${la.type} (min: ${la.minAmount}, max: ${la.maxAmount})`;
      }
      return la.type;
    })
    .join(", ");

  const potOdds = calculatePotOdds(toCall, obs.pot);
  const spr = obs.chips / obs.pot;

  return `CURRENT SITUATION:
- Your hand: ${hand}
- Community cards: ${community}
- Street: ${obs.street.toUpperCase()}
- Pot: ${obs.pot} chips
- Your chips: ${obs.chips}
- Your current bet: ${obs.currentBet}
- Amount to call: ${toCall}
- Minimum raise to: ${obs.minRaise}
- Your position: ${getPositionDescription(obs.position)}

STRATEGY METRICS:
- Pot odds: ${potOdds}
- Stack-to-Pot Ratio (SPR): ${spr.toFixed(1)}

OPPONENTS:
${opponents || "  None active"}

LEGAL ACTIONS: ${legalActionsStr}

Choose your action:`;
}

/**
 * Parse LLM response to extract poker action
 */
export function parsePokerAction(
  response: string,
  legalActions: { type: string; minAmount?: number; maxAmount?: number }[]
): { type: string; amount?: number } {
  const normalized = response.trim().toLowerCase();

  // Check for simple actions
  if (normalized === "fold") return { type: 'fold' };
  if (normalized === "check") return { type: 'check' };
  if (normalized === "call") return { type: 'call' };
  if (normalized === "all_in" || normalized === "allin" || normalized === "all-in") {
    return { type: 'all_in' };
  }

  // Parse bet <amount>
  const betMatch = normalized.match(/bet\s*(\d+)/);
  if (betMatch) {
    const amount = parseInt(betMatch[1], 10);
    const betAction = legalActions.find(a => a.type === 'bet');
    if (betAction) {
      const clampedAmount = Math.min(
        Math.max(amount, betAction.minAmount || 0),
        betAction.maxAmount || Infinity
      );
      return { type: 'bet', amount: clampedAmount };
    }
  }

  // Parse raise <amount>
  const raiseMatch = normalized.match(/raise\s*(\d+)/);
  if (raiseMatch) {
    const amount = parseInt(raiseMatch[1], 10);
    const raiseAction = legalActions.find(a => a.type === 'raise');
    if (raiseAction) {
      const clampedAmount = Math.min(
        Math.max(amount, raiseAction.minAmount || 0),
        raiseAction.maxAmount || Infinity
      );
      return { type: 'raise', amount: clampedAmount };
    }
  }

  // If just "bet" or "raise" without amount, use minimum
  if (normalized.startsWith("bet")) {
    const betAction = legalActions.find(a => a.type === 'bet');
    if (betAction) {
      return { type: 'bet', amount: betAction.minAmount };
    }
  }
  if (normalized.startsWith("raise")) {
    const raiseAction = legalActions.find(a => a.type === 'raise');
    if (raiseAction) {
      return { type: 'raise', amount: raiseAction.minAmount };
    }
  }

  // Default to first legal action if unparseable
  console.warn(`Could not parse poker action: "${response}", using first legal action`);
  const firstAction = legalActions[0];
  if (firstAction.type === 'bet' || firstAction.type === 'raise') {
    return { type: firstAction.type, amount: firstAction.minAmount };
  }
  return { type: firstAction.type };
}

/**
 * Estimate hand strength (simplified pre-flop evaluation)
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

    // Premium pairs (JJ+)
    if (isPair && highRank >= 9) return "Premium (high pair: JJ+)";
    // Medium pairs (77-TT)
    if (isPair && highRank >= 5) return "Strong (medium pair: 77-TT)";
    // Low pairs (22-66)
    if (isPair) return "Speculative (low pair: 22-66)";

    // Big cards (AK, AQ, KQ)
    if (highRank >= 11 && lowRank >= 10) {
      return isSuited ? "Premium (big suited: AKs, AQs, KQs)" : "Strong (big offsuit: AKo, AQo)";
    }

    // Suited aces
    if (isSuited && (c1.rank === "A" || c2.rank === "A")) {
      return lowRank >= 8 ? "Strong (suited broadway ace)" : "Speculative (suited ace)";
    }

    // Suited connectors
    if (isSuited && gap <= 2 && lowRank >= 5) {
      return "Speculative (suited connector)";
    }

    // Broadway cards
    if (highRank >= 10 && lowRank >= 8) {
      return isSuited ? "Playable (suited broadway)" : "Marginal (offsuit broadway)";
    }

    // High card combos
    if (highRank === 12) { // Ace
      return lowRank >= 8 ? "Marginal (ace with kicker)" : "Weak (weak ace)";
    }

    return "Weak (fold candidate)";
  }

  // Post-flop - would need full hand evaluation
  return "Evaluate based on board texture and hand strength";
}
