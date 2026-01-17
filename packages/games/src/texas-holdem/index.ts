/**
 * Texas Hold'em Game Definition
 */

import { createRng, type GameDefinition, type Rng, type GameEvent } from '@cmax/core';
import type {
  TexasHoldemState,
  TexasHoldemAction,
  TexasHoldemObservation,
  TexasHoldemConfig,
  Player,
} from './types.js';
import { createDeck, shuffleDeck } from './deck.js';
import {
  getButtonPosition,
  getBlindPositions,
  getPositionName,
  getFirstToAct,
  getNextToAct,
  countPlayersAbleToAct,
} from './positions.js';
import {
  getLegalActions,
  processAction,
  transitionStreet,
  calculatePots,
  getTotalPot,
} from './betting.js';
import { resolveShowdown, resolveWithoutShowdown } from './showdown.js';

// Default configuration
const DEFAULT_CONFIG: TexasHoldemConfig = {
  numPlayers: 2,
  startingChips: 10000,
  smallBlind: 50,
  bigBlind: 100,
};

export const texasHoldem: GameDefinition<
  TexasHoldemState,
  TexasHoldemAction,
  TexasHoldemObservation,
  TexasHoldemConfig
> = {
  id: 'texas_holdem',
  version: '1.0.0',
  numPlayers: { min: 2, max: 6 },

  reset({ seed, config }) {
    const cfg: TexasHoldemConfig = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Create RNG from seed
    const rng = createRng(seed);

    // Create and shuffle deck
    const deck = shuffleDeck(createDeck(), rng);

    // Initialize players
    const players: Player[] = [];
    for (let i = 0; i < cfg.numPlayers; i++) {
      players.push({
        id: i,
        agentId: '', // Set by orchestrator
        chips: cfg.startingChips,
        holeCards: null,
        currentBet: 0,
        totalInvested: 0,
        status: 'waiting',
        hasActed: false,
        isButton: false,
        isSmallBlind: false,
        isBigBlind: false,
      });
    }

    // Start first hand
    return startHand({
      players,
      numPlayers: cfg.numPlayers,
      deck,
      communityCards: [],
      burnCards: [],
      buttonPosition: cfg.numPlayers - 1, // Will be incremented to 0
      betting: {
        street: 'preflop',
        currentBet: 0,
        minRaise: cfg.bigBlind,
        lastRaiser: null,
        lastAction: null,
        numRaises: 0,
        potBeforeStreet: 0,
      },
      pots: [],
      currentPlayer: null,
      handNumber: 0,
      isHandComplete: false,
      config: cfg,
    }, rng);
  },

  observe({ state, playerId }): TexasHoldemObservation {
    const player = state.players[playerId];
    const position = getPositionName(playerId, state.buttonPosition, state.numPlayers);

    return {
      playerId,
      holeCards: player.holeCards!,
      chips: player.chips,
      currentBet: player.currentBet,
      position,
      communityCards: state.communityCards,
      street: state.betting.street,
      pot: getTotalPot(state),
      currentBetToCall: state.betting.currentBet,
      minRaise: state.betting.minRaise,
      opponents: state.players
        .filter((p: Player) => p.id !== playerId)
        .map((p: Player) => ({
          playerId: p.id,
          agentId: p.agentId,
          chips: p.chips,
          currentBet: p.currentBet,
          status: p.status,
          position: getPositionName(p.id, state.buttonPosition, state.numPlayers),
        })),
      actions: [], // TODO: Build action history
      legalActions: getLegalActions(player, state.betting, state.players),
    };
  },

  legalActions({ state, playerId }): TexasHoldemAction[] {
    const player = state.players[playerId];
    const legalActions = getLegalActions(player, state.betting, state.players);

    return legalActions.map(la => {
      if (la.type === 'bet' || la.type === 'raise') {
        return { type: la.type, amount: la.minAmount! };
      }
      return { type: la.type };
    }) as TexasHoldemAction[];
  },

  currentPlayer(state): number | null {
    return state.currentPlayer;
  },

  step({ state, playerId, action, rng }) {
    // Validate action
    const legalActions = getLegalActions(
      state.players[playerId],
      state.betting,
      state.players
    );
    const isLegal = legalActions.some(la => {
      if (la.type !== action.type) return false;
      if ((la.type === 'bet' || la.type === 'raise') && action.amount !== undefined) {
        return action.amount >= (la.minAmount || 0) && action.amount <= (la.maxAmount || Infinity);
      }
      return true;
    });

    let finalAction = action;
    if (!isLegal) {
      // Fall back to first legal action
      const fallbackAction = legalActions[0];
      finalAction = fallbackAction.type === 'bet' || fallbackAction.type === 'raise'
        ? { type: fallbackAction.type, amount: fallbackAction.minAmount }
        : { type: fallbackAction.type };
    }

    // Process action
    let newState = processAction(state, {
      ...finalAction,
      playerId,
    });

    // Check if hand ends (everyone folded to one player)
    const activePlayers = newState.players.filter(
      (p: Player) => p.status !== 'folded' && p.status !== 'sitting_out'
    );

    if (activePlayers.length === 1) {
      // Hand over, award pot
      const winner = activePlayers[0];
      const pots = calculatePots(newState.players);
      const result = resolveWithoutShowdown(winner, pots);
      result.handNumber = newState.handNumber;

      // Award chips
      const newPlayers = newState.players.map((p: Player) => ({ ...p }));
      newPlayers[winner.id].chips += result.winners[0].amountWon;

      newState = {
        ...newState,
        players: newPlayers,
        pots,
        isHandComplete: true,
      };

      // Check if match is over
      if (isMatchOver(newState)) {
        const events: GameEvent[] = [
          { type: 'ACTION', data: { playerId, action: finalAction } as Record<string, unknown> },
          { type: 'HAND_COMPLETE', data: result as unknown as Record<string, unknown> },
        ];
        return { state: newState, events };
      }

      // Start next hand
      newState = startHand(newState, rng);

      const events: GameEvent[] = [
        { type: 'ACTION', data: { playerId, action: finalAction } as Record<string, unknown> },
        { type: 'HAND_COMPLETE', data: result as unknown as Record<string, unknown> },
        { type: 'NEW_HAND', data: { handNumber: newState.handNumber } as Record<string, unknown> },
      ];
      return { state: newState, events };
    }

    // Find next player
    const nextPlayer = getNextToAct(
      newState.players,
      playerId,
      newState.betting.lastRaiser
    );

    if (nextPlayer === null) {
      // Betting complete, check if all remaining players are all-in
      const playersAbleToAct = countPlayersAbleToAct(newState.players);

      if (playersAbleToAct <= 1 || newState.betting.street === 'river') {
        // Go to showdown
        const pots = calculatePots(newState.players);

        // If players are all-in, deal remaining cards
        newState = dealRemainingCards(newState);

        const result = resolveShowdown(
          newState.players,
          newState.communityCards,
          pots
        );
        result.handNumber = newState.handNumber;

        // Award chips
        const newPlayers = newState.players.map((p: Player) => ({ ...p }));
        for (const winner of result.winners) {
          newPlayers[winner.playerId].chips += winner.amountWon;
        }

        newState = {
          ...newState,
          players: newPlayers,
          pots,
          isHandComplete: true,
        };

        // Check if match is over
        if (isMatchOver(newState)) {
          const events: GameEvent[] = [
            { type: 'ACTION', data: { playerId, action: finalAction } as Record<string, unknown> },
            { type: 'SHOWDOWN', data: result as unknown as Record<string, unknown> },
            { type: 'HAND_COMPLETE', data: result as unknown as Record<string, unknown> },
          ];
          return { state: newState, events };
        }

        // Start next hand
        newState = startHand(newState, rng);

        const events: GameEvent[] = [
          { type: 'ACTION', data: { playerId, action: finalAction } as Record<string, unknown> },
          { type: 'SHOWDOWN', data: result as unknown as Record<string, unknown> },
          { type: 'HAND_COMPLETE', data: result as unknown as Record<string, unknown> },
          { type: 'NEW_HAND', data: { handNumber: newState.handNumber } as Record<string, unknown> },
        ];
        return { state: newState, events };
      }

      // Deal next street
      newState = transitionStreet(newState);

      const events: GameEvent[] = [
        { type: 'ACTION', data: { playerId, action: finalAction } as Record<string, unknown> },
        { type: 'STREET', data: {
          street: newState.betting.street,
          cards: newState.communityCards
        } as Record<string, unknown> },
      ];
      return { state: newState, events };
    }

    const events: GameEvent[] = [
      { type: 'ACTION', data: { playerId, action: finalAction } as Record<string, unknown> },
    ];
    return {
      state: { ...newState, currentPlayer: nextPlayer },
      events,
    };
  },

  isTerminal(state): boolean {
    // Game ends when one player has all chips
    const playersWithChips = state.players.filter((p: Player) => p.chips > 0);
    return playersWithChips.length <= 1;
  },

  getResults(state) {
    const sortedByChips = [...state.players].sort((a, b) => b.chips - a.chips);
    const winner = sortedByChips[0];

    return {
      winner: winner.id,
      isDraw: false,
      players: state.players.map((p: Player) => ({
        playerId: p.id,
        score: p.chips,
        rank: sortedByChips.findIndex(sp => sp.id === p.id),
      })),
    };
  },
};

/**
 * Start a new hand
 */
function startHand(state: TexasHoldemState, rng: Rng): TexasHoldemState {
  // Move button
  const buttonPosition = getButtonPosition(state.players, state.buttonPosition);
  const { smallBlind, bigBlind } = getBlindPositions(buttonPosition, state.numPlayers);

  // Shuffle new deck
  const deck = shuffleDeck(createDeck(), rng);

  // Reset players for new hand
  type PlayerStatus = 'waiting' | 'sitting_out' | 'all_in';
  const players: Player[] = state.players.map((p: Player, i: number) => ({
    ...p,
    holeCards: null,
    currentBet: 0,
    totalInvested: 0,
    status: (p.chips > 0 ? 'waiting' : 'sitting_out') as PlayerStatus,
    hasActed: false,
    isButton: i === buttonPosition,
    isSmallBlind: i === smallBlind,
    isBigBlind: i === bigBlind,
  }));

  // Deal hole cards (2 cards each)
  const activePlayers = players.filter((p: Player) => p.status !== 'sitting_out');
  for (const player of activePlayers) {
    const card1 = deck.pop()!;
    const card2 = deck.pop()!;
    player.holeCards = [card1, card2];
  }

  // Post blinds
  const sbAmount = Math.min(state.config.smallBlind, players[smallBlind].chips);
  players[smallBlind].chips -= sbAmount;
  players[smallBlind].currentBet = sbAmount;
  players[smallBlind].totalInvested = sbAmount;

  const bbAmount = Math.min(state.config.bigBlind, players[bigBlind].chips);
  players[bigBlind].chips -= bbAmount;
  players[bigBlind].currentBet = bbAmount;
  players[bigBlind].totalInvested = bbAmount;

  if (players[smallBlind].chips === 0) {
    players[smallBlind].status = 'all_in';
  }
  if (players[bigBlind].chips === 0) {
    players[bigBlind].status = 'all_in';
  }

  // Find first to act
  const firstToAct = getFirstToAct(players, buttonPosition, 'preflop');

  return {
    ...state,
    players,
    deck,
    communityCards: [],
    burnCards: [],
    buttonPosition,
    betting: {
      street: 'preflop',
      currentBet: bbAmount,
      minRaise: state.config.bigBlind,
      lastRaiser: bigBlind,
      lastAction: null,
      numRaises: 0,
      potBeforeStreet: 0,
    },
    pots: [],
    currentPlayer: firstToAct === -1 ? null : firstToAct,
    handNumber: state.handNumber + 1,
    isHandComplete: false,
  };
}

/**
 * Deal remaining community cards for all-in situations
 */
function dealRemainingCards(state: TexasHoldemState): TexasHoldemState {
  const newDeck = [...state.deck];
  const newCommunityCards = [...state.communityCards];
  const newBurnCards = [...state.burnCards];

  // Deal cards until we have 5 community cards
  while (newCommunityCards.length < 5) {
    // Burn a card
    const burnCard = newDeck.pop();
    if (burnCard) newBurnCards.push(burnCard);

    // Deal card(s)
    const cardsToDeal = newCommunityCards.length === 0 ? 3 : 1;
    for (let i = 0; i < cardsToDeal && newCommunityCards.length < 5; i++) {
      const card = newDeck.pop();
      if (card) newCommunityCards.push(card);
    }
  }

  return {
    ...state,
    deck: newDeck,
    communityCards: newCommunityCards,
    burnCards: newBurnCards,
  };
}

/**
 * Check if the match is over (one player has all chips)
 */
function isMatchOver(state: TexasHoldemState): boolean {
  const playersWithChips = state.players.filter((p: Player) => p.chips > 0);
  return playersWithChips.length <= 1;
}

// Export types and utilities
export * from './types.js';
export { formatCard, formatCards, cardToString, stringToCard } from './deck.js';
export { getPositionName } from './positions.js';
export { evaluateHand, compareHands, getHandRankValue } from './hands.js';
