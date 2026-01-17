/**
 * Hand Evaluation
 *
 * Uses pokersolver for robust hand evaluation
 */

import type { Card, EvaluatedHand, HandRank, PokersolverHand } from './types.js';
import { cardToSolverFormat } from './deck.js';

// pokersolver doesn't have types, so we use require and cast
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Hand } = require('pokersolver') as {
  Hand: {
    solve(cards: string[]): PokersolverHand;
    winners(hands: PokersolverHand[]): PokersolverHand[];
  };
};

/**
 * Map pokersolver rank to our HandRank type
 */
function mapRank(pokersolverRank: number): HandRank {
  const ranks: HandRank[] = [
    'high_card',      // 1
    'pair',           // 2
    'two_pair',       // 3
    'three_of_a_kind', // 4
    'straight',       // 5
    'flush',          // 6
    'full_house',     // 7
    'four_of_a_kind', // 8
    'straight_flush', // 9
    'royal_flush',    // 10
  ];
  return ranks[pokersolverRank - 1] || 'high_card';
}

/**
 * Convert pokersolver card to our Card type
 */
function solverCardToCard(solverCard: { value: string; suit: string }): Card {
  const rankMap: Record<string, Card['rank']> = {
    '10': 'T',
    'J': 'J',
    'Q': 'Q',
    'K': 'K',
    'A': 'A',
  };
  const rank = rankMap[solverCard.value] || (solverCard.value as Card['rank']);
  return {
    rank,
    suit: solverCard.suit as Card['suit'],
  };
}

/**
 * Evaluate a poker hand from hole cards and community cards
 */
export function evaluateHand(holeCards: [Card, Card], communityCards: Card[]): EvaluatedHand {
  // Convert all cards to pokersolver format
  const allCards = [...holeCards, ...communityCards];
  const cardStrings = allCards.map(cardToSolverFormat);

  // Solve the hand
  const hand = Hand.solve(cardStrings);

  // Convert back to our types
  return {
    rank: mapRank(hand.rank),
    cards: hand.cards.slice(0, 5).map(solverCardToCard),
    description: hand.descr,
  };
}

/**
 * Compare two evaluated hands
 * Returns: -1 if hand1 wins, 1 if hand2 wins, 0 if tie
 */
export function compareHands(hand1: EvaluatedHand, hand2: EvaluatedHand): -1 | 0 | 1 {
  // Recreate hands for comparison
  const h1Cards = hand1.cards.map(cardToSolverFormat);
  const h2Cards = hand2.cards.map(cardToSolverFormat);

  const h1 = Hand.solve(h1Cards);
  const h2 = Hand.solve(h2Cards);

  const winners = Hand.winners([h1, h2]);

  if (winners.length === 2) return 0; // Tie
  return winners[0] === h1 ? -1 : 1;
}

/**
 * Find winners among multiple hands (handles ties)
 */
export function findWinners(hands: { playerId: number; hand: EvaluatedHand }[]): number[] {
  if (hands.length === 0) return [];
  if (hands.length === 1) return [hands[0].playerId];

  // Convert all hands to pokersolver format
  const solverHands = hands.map(h => ({
    playerId: h.playerId,
    solverHand: Hand.solve(h.hand.cards.map(cardToSolverFormat)),
  }));

  // Get winners
  const winnerSolverHands = Hand.winners(solverHands.map(h => h.solverHand));

  // Map back to player IDs
  return solverHands
    .filter(h => winnerSolverHands.includes(h.solverHand))
    .map(h => h.playerId);
}

/**
 * Get hand rank as a numeric value for comparison
 */
export function getHandRankValue(rank: HandRank): number {
  const values: Record<HandRank, number> = {
    'high_card': 1,
    'pair': 2,
    'two_pair': 3,
    'three_of_a_kind': 4,
    'straight': 5,
    'flush': 6,
    'full_house': 7,
    'four_of_a_kind': 8,
    'straight_flush': 9,
    'royal_flush': 10,
  };
  return values[rank];
}
