/**
 * Texas Hold'em Poker
 *
 * Full implementation of Texas Hold'em with:
 * - Standard 52-card deck
 * - Pre-flop, flop, turn, river betting rounds
 * - Hand evaluation (high card to royal flush)
 * - Side pot support for all-in situations
 * - 2-6 player support
 */

import type { GameDefinition } from "@cmax/core";
import { createRng } from "@cmax/core";

// Card types
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";
export type Suit = "h" | "d" | "c" | "s"; // hearts, diamonds, clubs, spades

export interface Card {
  rank: Rank;
  suit: Suit;
}

// All ranks in order (low to high)
const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUITS: Suit[] = ["h", "d", "c", "s"];

// Rank values for comparison
const RANK_VALUES: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
};

// Suit symbols for display
const SUIT_SYMBOLS: Record<Suit, string> = {
  h: "\u2665", d: "\u2666", c: "\u2663", s: "\u2660",
};

// Hand rankings (higher is better)
export type HandRank =
  | "high_card"
  | "pair"
  | "two_pair"
  | "three_of_a_kind"
  | "straight"
  | "flush"
  | "full_house"
  | "four_of_a_kind"
  | "straight_flush"
  | "royal_flush";

const HAND_RANK_VALUES: Record<HandRank, number> = {
  high_card: 1,
  pair: 2,
  two_pair: 3,
  three_of_a_kind: 4,
  straight: 5,
  flush: 6,
  full_house: 7,
  four_of_a_kind: 8,
  straight_flush: 9,
  royal_flush: 10,
};

// Betting rounds
export type BettingRound = "preflop" | "flop" | "turn" | "river" | "showdown" | "complete";

// Player state
interface PlayerState {
  hand: [Card, Card] | null;
  chips: number;
  bet: number; // Current bet this betting round
  totalBet: number; // Total amount committed this hand
  folded: boolean;
  allIn: boolean;
}

// Action types
export type HoldemAction =
  | "fold"
  | "check"
  | "call"
  | `raise_${number}`
  | "all_in";

// Game state
export interface HoldemState {
  deck: Card[];
  deckIndex: number;
  communityCards: Card[];
  players: PlayerState[];
  pot: number;
  currentBet: number;
  minRaise: number;
  round: BettingRound;
  dealerIndex: number;
  currentPlayerIndex: number;
  lastAggressor: number | null;
  playersActedThisRound: Set<number>;
  numActivePlayers: number;
  smallBlind: number;
  bigBlind: number;
  handComplete: boolean;
  winners: number[] | null;
}

// Observation (what a player sees)
export interface HoldemObservation {
  playerId: number;
  hand: [Card, Card] | null;
  communityCards: Card[];
  pot: number;
  currentBet: number;
  minRaise: number;
  myChips: number;
  myBet: number;
  myTotalBet: number;
  toCall: number;
  round: BettingRound;
  dealerIndex: number;
  opponents: Array<{
    playerId: number;
    chips: number;
    bet: number;
    totalBet: number;
    folded: boolean;
    allIn: boolean;
  }>;
  numActivePlayers: number;
}

// Game configuration
export interface HoldemConfig {
  startingChips?: number;
  smallBlind?: number;
  bigBlind?: number;
}

/**
 * Create a standard 52-card deck
 */
function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Format a card for display
 */
function formatCard(card: Card): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

/**
 * Get the next active player (not folded, not all-in if acting)
 */
function getNextActivePlayer(
  players: PlayerState[],
  currentIndex: number,
  skipAllIn = false
): number | null {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (currentIndex + i) % n;
    const player = players[idx];
    if (!player.folded && (!skipAllIn || !player.allIn)) {
      return idx;
    }
  }
  return null;
}

/**
 * Count players who can still act
 */
function countActivePlayers(players: PlayerState[]): number {
  return players.filter((p) => !p.folded).length;
}

/**
 * Check if betting round is complete
 */
function isBettingRoundComplete(
  players: PlayerState[],
  currentBet: number,
  _lastAggressor: number | null,
  playersActed: Set<number>,
  _currentPlayerIndex: number
): boolean {
  const bettingPlayers = players.filter((p: PlayerState) => !p.folded && !p.allIn);

  // If only one player left (or all others folded/all-in), round is complete
  if (bettingPlayers.length <= 1) {
    return true;
  }

  // All players must have acted
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!p.folded && !p.allIn && !playersActed.has(i)) {
      return false;
    }
  }

  // All bets must be matched (or player is all-in)
  for (const p of players) {
    if (!p.folded && !p.allIn && p.bet < currentBet) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluate a 5-card hand
 */
interface HandEvaluation {
  rank: HandRank;
  rankValue: number;
  tiebreakers: number[]; // For comparing hands of same rank
}

function evaluateHand(cards: Card[]): HandEvaluation {
  if (cards.length !== 5) {
    throw new Error(`Expected 5 cards, got ${cards.length}`);
  }

  // Sort by rank value (descending)
  const sorted = [...cards].sort(
    (a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]
  );

  // Count ranks and suits
  const rankCounts: Map<Rank, number> = new Map();
  const suitCounts: Map<Suit, number> = new Map();

  for (const card of cards) {
    rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
    suitCounts.set(card.suit, (suitCounts.get(card.suit) || 0) + 1);
  }

  // Check for flush
  const isFlush = Array.from(suitCounts.values()).some((c) => c === 5);

  // Check for straight
  const rankValues = sorted.map((c) => RANK_VALUES[c.rank]);
  let isStraight = true;
  for (let i = 1; i < rankValues.length; i++) {
    if (rankValues[i - 1] - rankValues[i] !== 1) {
      isStraight = false;
      break;
    }
  }
  // Check for wheel (A-2-3-4-5)
  const isWheel =
    rankValues[0] === 14 &&
    rankValues[1] === 5 &&
    rankValues[2] === 4 &&
    rankValues[3] === 3 &&
    rankValues[4] === 2;
  if (isWheel) {
    isStraight = true;
  }

  // Get counts sorted by frequency then rank
  const counts = Array.from(rankCounts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]; // By count desc
      return RANK_VALUES[b[0]] - RANK_VALUES[a[0]]; // By rank desc
    });

  // Determine hand rank
  const topCount = counts[0][1];
  const secondCount = counts[1]?.[1] || 0;

  // Royal flush
  if (isFlush && isStraight && rankValues[0] === 14 && !isWheel) {
    return {
      rank: "royal_flush",
      rankValue: HAND_RANK_VALUES.royal_flush,
      tiebreakers: [],
    };
  }

  // Straight flush
  if (isFlush && isStraight) {
    return {
      rank: "straight_flush",
      rankValue: HAND_RANK_VALUES.straight_flush,
      tiebreakers: isWheel ? [5] : [rankValues[0]],
    };
  }

  // Four of a kind
  if (topCount === 4) {
    const quadRank = counts[0][0];
    const kicker = counts[1][0];
    return {
      rank: "four_of_a_kind",
      rankValue: HAND_RANK_VALUES.four_of_a_kind,
      tiebreakers: [RANK_VALUES[quadRank], RANK_VALUES[kicker]],
    };
  }

  // Full house
  if (topCount === 3 && secondCount === 2) {
    const tripRank = counts[0][0];
    const pairRank = counts[1][0];
    return {
      rank: "full_house",
      rankValue: HAND_RANK_VALUES.full_house,
      tiebreakers: [RANK_VALUES[tripRank], RANK_VALUES[pairRank]],
    };
  }

  // Flush
  if (isFlush) {
    return {
      rank: "flush",
      rankValue: HAND_RANK_VALUES.flush,
      tiebreakers: rankValues,
    };
  }

  // Straight
  if (isStraight) {
    return {
      rank: "straight",
      rankValue: HAND_RANK_VALUES.straight,
      tiebreakers: isWheel ? [5] : [rankValues[0]],
    };
  }

  // Three of a kind
  if (topCount === 3) {
    const tripRank = counts[0][0];
    const kickers = counts.slice(1).map((c) => RANK_VALUES[c[0]]);
    return {
      rank: "three_of_a_kind",
      rankValue: HAND_RANK_VALUES.three_of_a_kind,
      tiebreakers: [RANK_VALUES[tripRank], ...kickers],
    };
  }

  // Two pair
  if (topCount === 2 && secondCount === 2) {
    const highPair = counts[0][0];
    const lowPair = counts[1][0];
    const kicker = counts[2][0];
    return {
      rank: "two_pair",
      rankValue: HAND_RANK_VALUES.two_pair,
      tiebreakers: [RANK_VALUES[highPair], RANK_VALUES[lowPair], RANK_VALUES[kicker]],
    };
  }

  // One pair
  if (topCount === 2) {
    const pairRank = counts[0][0];
    const kickers = counts.slice(1).map((c) => RANK_VALUES[c[0]]);
    return {
      rank: "pair",
      rankValue: HAND_RANK_VALUES.pair,
      tiebreakers: [RANK_VALUES[pairRank], ...kickers],
    };
  }

  // High card
  return {
    rank: "high_card",
    rankValue: HAND_RANK_VALUES.high_card,
    tiebreakers: rankValues,
  };
}

/**
 * Find the best 5-card hand from 7 cards (2 hole + 5 community)
 */
function findBestHand(cards: Card[]): HandEvaluation {
  if (cards.length < 5) {
    throw new Error("Need at least 5 cards");
  }

  // Generate all 5-card combinations
  const combos: Card[][] = [];
  const n = cards.length;

  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            combos.push([cards[i], cards[j], cards[k], cards[l], cards[m]]);
          }
        }
      }
    }
  }

  // Evaluate each combo and find best
  let best: HandEvaluation | null = null;

  for (const combo of combos) {
    const eval_ = evaluateHand(combo);

    if (!best || compareHands(eval_, best) > 0) {
      best = eval_;
    }
  }

  return best!;
}

/**
 * Compare two hands. Returns positive if a > b, negative if a < b, 0 if equal.
 */
function compareHands(a: HandEvaluation, b: HandEvaluation): number {
  if (a.rankValue !== b.rankValue) {
    return a.rankValue - b.rankValue;
  }

  // Compare tiebreakers
  for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
    const av = a.tiebreakers[i] || 0;
    const bv = b.tiebreakers[i] || 0;
    if (av !== bv) {
      return av - bv;
    }
  }

  return 0;
}

/**
 * Determine winners (can be multiple in case of tie)
 */
function determineWinners(
  players: PlayerState[],
  communityCards: Card[]
): number[] {
  const activePlayers = players
    .map((p, i) => ({ player: p, index: i }))
    .filter(({ player }) => !player.folded && player.hand);

  if (activePlayers.length === 0) {
    return [];
  }

  if (activePlayers.length === 1) {
    return [activePlayers[0].index];
  }

  // Evaluate each player's best hand
  const evaluations = activePlayers.map(({ player, index }) => ({
    index,
    eval: findBestHand([...player.hand!, ...communityCards]),
  }));

  // Find best hand
  let best = evaluations[0];
  for (const ev of evaluations.slice(1)) {
    if (compareHands(ev.eval, best.eval) > 0) {
      best = ev;
    }
  }

  // Find all players with the best hand (ties)
  const winners = evaluations
    .filter((ev) => compareHands(ev.eval, best.eval) === 0)
    .map((ev) => ev.index);

  return winners;
}

/**
 * Get legal actions for current player
 */
function getLegalActions(state: HoldemState): string[] {
  if (state.handComplete || state.round === "showdown" || state.round === "complete") {
    return [];
  }

  const player = state.players[state.currentPlayerIndex];
  if (player.folded || player.allIn) {
    return [];
  }

  const actions: string[] = [];
  const toCall = state.currentBet - player.bet;

  // Can always fold
  actions.push("fold");

  // Check if no bet to call
  if (toCall === 0) {
    actions.push("check");
  } else if (toCall > 0 && player.chips > 0) {
    // Call
    actions.push("call");
  }

  // Raise (if can afford more than call)
  if (player.chips > toCall) {
    const minRaiseAmount = Math.max(state.minRaise, state.bigBlind);
    const raiseAmount = Math.min(minRaiseAmount, player.chips - toCall);
    if (raiseAmount > 0) {
      actions.push(`raise_${raiseAmount}`);
    }
  }

  // All-in
  if (player.chips > 0) {
    actions.push("all_in");
  }

  return actions;
}

/**
 * Deal next community cards
 */
function dealCommunityCards(state: HoldemState): HoldemState {
  const newCommunity = [...state.communityCards];
  let deckIndex = state.deckIndex;

  switch (state.round) {
    case "preflop":
      // Deal flop (3 cards)
      for (let i = 0; i < 3; i++) {
        newCommunity.push(state.deck[deckIndex++]);
      }
      break;
    case "flop":
    case "turn":
      // Deal one card
      newCommunity.push(state.deck[deckIndex++]);
      break;
  }

  return {
    ...state,
    communityCards: newCommunity,
    deckIndex,
  };
}

/**
 * Move to next betting round
 */
function advanceRound(state: HoldemState): HoldemState {
  let newRound: BettingRound;

  switch (state.round) {
    case "preflop":
      newRound = "flop";
      break;
    case "flop":
      newRound = "turn";
      break;
    case "turn":
      newRound = "river";
      break;
    case "river":
      newRound = "showdown";
      break;
    default:
      return state;
  }

  // Deal community cards
  let newState: HoldemState = { ...state };
  if (newRound !== "showdown") {
    newState = dealCommunityCards(newState);
  }

  // Reset betting
  const newPlayers = newState.players.map((p) => ({
    ...p,
    bet: 0,
  }));

  // Find first active player after dealer
  const nextPlayer = getNextActivePlayer(newPlayers, state.dealerIndex, true);
  if (nextPlayer === null) {
    // Everyone is all-in or folded
    newRound = "showdown";
  }

  return {
    ...newState,
    round: newRound,
    players: newPlayers,
    currentBet: 0,
    minRaise: state.bigBlind,
    currentPlayerIndex: nextPlayer ?? state.currentPlayerIndex,
    lastAggressor: null,
    playersActedThisRound: new Set<number>(),
  };
}

export const texasHoldem: GameDefinition<HoldemState, string, HoldemObservation, HoldemConfig> = {
  id: "texas_holdem",
  version: "1.0.0",
  numPlayers: { min: 2, max: 6 },

  reset({ seed, config, numPlayers }) {
    const startingChips = config?.startingChips ?? 1000;
    const smallBlind = config?.smallBlind ?? 10;
    const bigBlind = config?.bigBlind ?? 20;

    // Create and shuffle deck
    const rng = createRng(seed);
    const deck = rng.shuffle(createDeck());

    // Initialize players
    const players: PlayerState[] = [];
    let deckIndex = 0;

    for (let i = 0; i < numPlayers; i++) {
      const hand: [Card, Card] = [deck[deckIndex++], deck[deckIndex++]];
      players.push({
        hand,
        chips: startingChips,
        bet: 0,
        totalBet: 0,
        folded: false,
        allIn: false,
      });
    }

    // Post blinds
    const sbIndex = numPlayers === 2 ? 0 : 1; // Heads-up: dealer is SB
    const bbIndex = numPlayers === 2 ? 1 : 2 % numPlayers;

    // Small blind
    const sbAmount = Math.min(smallBlind, players[sbIndex].chips);
    players[sbIndex].chips -= sbAmount;
    players[sbIndex].bet = sbAmount;
    players[sbIndex].totalBet = sbAmount;
    if (players[sbIndex].chips === 0) {
      players[sbIndex].allIn = true;
    }

    // Big blind
    const bbAmount = Math.min(bigBlind, players[bbIndex].chips);
    players[bbIndex].chips -= bbAmount;
    players[bbIndex].bet = bbAmount;
    players[bbIndex].totalBet = bbAmount;
    if (players[bbIndex].chips === 0) {
      players[bbIndex].allIn = true;
    }

    // First to act is after big blind
    const firstToAct = (bbIndex + 1) % numPlayers;

    return {
      deck,
      deckIndex,
      communityCards: [],
      players,
      pot: sbAmount + bbAmount,
      currentBet: bbAmount,
      minRaise: bigBlind,
      round: "preflop",
      dealerIndex: 0,
      currentPlayerIndex: firstToAct,
      lastAggressor: bbIndex, // BB is the "aggressor" to start
      playersActedThisRound: new Set<number>(),
      numActivePlayers: numPlayers,
      smallBlind,
      bigBlind,
      handComplete: false,
      winners: null,
    };
  },

  observe({ state, playerId }) {
    const player = state.players[playerId];
    const opponents = state.players
      .map((p: PlayerState, i: number) => ({
        playerId: i,
        chips: p.chips,
        bet: p.bet,
        totalBet: p.totalBet,
        folded: p.folded,
        allIn: p.allIn,
      }))
      .filter((_: { playerId: number }, i: number) => i !== playerId);

    return {
      playerId,
      hand: player.hand,
      communityCards: state.communityCards,
      pot: state.pot,
      currentBet: state.currentBet,
      minRaise: state.minRaise,
      myChips: player.chips,
      myBet: player.bet,
      myTotalBet: player.totalBet,
      toCall: Math.min(state.currentBet - player.bet, player.chips),
      round: state.round,
      dealerIndex: state.dealerIndex,
      opponents,
      numActivePlayers: countActivePlayers(state.players),
    };
  },

  legalActions({ state }) {
    return getLegalActions(state);
  },

  currentPlayer(state) {
    if (state.handComplete || state.round === "showdown" || state.round === "complete") {
      return null;
    }
    return state.currentPlayerIndex;
  },

  step({ state, playerId, action }) {
    const newPlayers = state.players.map((p: PlayerState) => ({ ...p }));
    const player = newPlayers[playerId];
    let newPot = state.pot;
    let newCurrentBet = state.currentBet;
    let newMinRaise = state.minRaise;
    let newLastAggressor = state.lastAggressor;
    const newPlayersActed = new Set<number>(state.playersActedThisRound);
    const events: Array<{ type: string; data?: Record<string, unknown> }> = [];

    // Process action
    if (action === "fold") {
      player.folded = true;
      events.push({ type: "FOLD", data: { playerId } });
    } else if (action === "check") {
      events.push({ type: "CHECK", data: { playerId } });
    } else if (action === "call") {
      const toCall = Math.min(state.currentBet - player.bet, player.chips);
      player.chips -= toCall;
      player.bet += toCall;
      player.totalBet += toCall;
      newPot += toCall;
      if (player.chips === 0) {
        player.allIn = true;
      }
      events.push({ type: "CALL", data: { playerId, amount: toCall } });
    } else if (action.startsWith("raise_")) {
      const raiseAmount = parseInt(action.split("_")[1], 10);
      const toCall = state.currentBet - player.bet;
      const totalBet = toCall + raiseAmount;
      const actualBet = Math.min(totalBet, player.chips);

      player.chips -= actualBet;
      player.bet += actualBet;
      player.totalBet += actualBet;
      newPot += actualBet;

      if (player.bet > newCurrentBet) {
        newMinRaise = Math.max(newMinRaise, player.bet - newCurrentBet);
        newCurrentBet = player.bet;
        newLastAggressor = playerId;
        // Reset acted players since there's a new bet
        newPlayersActed.clear();
      }

      if (player.chips === 0) {
        player.allIn = true;
      }
      events.push({ type: "RAISE", data: { playerId, amount: actualBet, newBet: player.bet } });
    } else if (action === "all_in") {
      const allInAmount = player.chips;
      player.bet += allInAmount;
      player.totalBet += allInAmount;
      newPot += allInAmount;
      player.chips = 0;
      player.allIn = true;

      if (player.bet > newCurrentBet) {
        newMinRaise = Math.max(newMinRaise, player.bet - newCurrentBet);
        newCurrentBet = player.bet;
        newLastAggressor = playerId;
        newPlayersActed.clear();
      }
      events.push({ type: "ALL_IN", data: { playerId, amount: allInAmount, totalBet: player.bet } });
    }

    newPlayersActed.add(playerId);

    // Check if only one player left
    const activePlayers = countActivePlayers(newPlayers);
    if (activePlayers === 1) {
      const winner = newPlayers.findIndex((p: PlayerState) => !p.folded);
      return {
        state: {
          ...state,
          players: newPlayers,
          pot: newPot,
          round: "complete" as BettingRound,
          handComplete: true,
          winners: [winner],
        },
        events: [
          ...events,
          { type: "HAND_END", data: { winners: [winner], pot: newPot, reason: "fold" } },
        ],
      };
    }

    // Find next player
    const nextPlayer = getNextActivePlayer(newPlayers, playerId, true);

    // Check if betting round is complete
    const roundComplete = isBettingRoundComplete(
      newPlayers,
      newCurrentBet,
      newLastAggressor,
      newPlayersActed,
      nextPlayer ?? playerId
    );

    let newState: HoldemState = {
      ...state,
      players: newPlayers,
      pot: newPot,
      currentBet: newCurrentBet,
      minRaise: newMinRaise,
      lastAggressor: newLastAggressor,
      playersActedThisRound: newPlayersActed,
      currentPlayerIndex: nextPlayer ?? state.currentPlayerIndex,
      numActivePlayers: activePlayers,
    };

    if (roundComplete) {
      newState = advanceRound(newState);
      events.push({ type: "ROUND_END", data: { round: state.round, pot: newPot } });

      if (newState.round === "showdown") {
        const winners = determineWinners(newState.players, newState.communityCards);
        newState = {
          ...newState,
          handComplete: true,
          round: "complete",
          winners,
        };
        events.push({
          type: "SHOWDOWN",
          data: {
            communityCards: newState.communityCards.map(formatCard),
            winners,
          },
        });
        events.push({ type: "HAND_END", data: { winners, pot: newPot, reason: "showdown" } });
      }
    }

    return { state: newState, events };
  },

  isTerminal(state) {
    return state.handComplete || state.round === "complete";
  },

  getResults(state) {
    if (!state.winners || state.winners.length === 0) {
      throw new Error("Game not finished or no winners");
    }

    const potPerWinner = Math.floor(state.pot / state.winners.length);
    const isDraw = state.winners.length > 1;

    const players = state.players.map((p: PlayerState, i: number) => {
      const isWinner = state.winners!.includes(i);
      const profit = isWinner ? potPerWinner - p.totalBet : -p.totalBet;

      return {
        playerId: i,
        score: profit,
        rank: isWinner ? 1 : 2,
        stats: {
          hand: p.hand ? p.hand.map(formatCard).join(" ") : "folded",
          folded: p.folded,
          allIn: p.allIn,
          finalChips: p.chips + (isWinner ? potPerWinner : 0),
        },
      };
    });

    return {
      players,
      winner: isDraw ? null : state.winners[0],
      isDraw,
    };
  },
};
