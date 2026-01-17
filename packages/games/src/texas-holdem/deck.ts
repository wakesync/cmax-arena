/**
 * Deck Operations
 */

import type { Card, Rank, Suit, CardString } from './types.js';
import type { Rng } from '@cmax/core';

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS: Suit[] = ['h', 'd', 'c', 's'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[], rng: Rng): Card[] {
  const shuffled = [...deck];
  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng.nextFloat() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function cardToString(card: Card): CardString {
  return `${card.rank}${card.suit}` as CardString;
}

export function stringToCard(str: CardString): Card {
  return {
    rank: str[0] as Rank,
    suit: str[1] as Suit,
  };
}

export function formatCard(card: Card): string {
  const suitSymbols: Record<Suit, string> = {
    h: '♥', d: '♦', c: '♣', s: '♠'
  };
  return `${card.rank}${suitSymbols[card.suit]}`;
}

export function formatCards(cards: Card[]): string {
  return cards.map(formatCard).join(' ');
}

/**
 * Convert card to pokersolver format
 */
export function cardToSolverFormat(card: Card): string {
  const rank = card.rank === 'T' ? '10' : card.rank;
  return `${rank}${card.suit}`;
}
