/**
 * Betting Logic
 */

import type {
  Player, TexasHoldemAction, LegalAction, BettingState, Pot, Street, TexasHoldemState
} from './types.js';
import { getFirstToAct } from './positions.js';

export function getLegalActions(
  player: Player,
  betting: BettingState,
  players: Player[]
): LegalAction[] {
  const actions: LegalAction[] = [];

  const toCall = betting.currentBet - player.currentBet;

  if (toCall === 0) {
    // Can check
    actions.push({ type: 'check' });

    // Can bet
    if (player.chips > 0) {
      const minBet = betting.minRaise;

      actions.push({
        type: 'bet',
        minAmount: Math.min(minBet, player.chips),
        maxAmount: player.chips,
      });
    }
  } else {
    // Facing a bet - always can fold
    actions.push({ type: 'fold' });

    // Can call if have chips
    if (player.chips > 0) {
      actions.push({ type: 'call' });
    }

    // Can raise if have more than call amount
    const minRaise = betting.currentBet + betting.minRaise;
    if (player.chips > toCall) {
      actions.push({
        type: 'raise',
        minAmount: Math.min(minRaise, player.chips + player.currentBet),
        maxAmount: player.chips + player.currentBet,
      });
    }
  }

  // All-in is always available if have chips
  if (player.chips > 0) {
    actions.push({ type: 'all_in' });
  }

  return actions;
}

export function processAction(
  state: TexasHoldemState,
  action: TexasHoldemAction & { playerId: number }
): TexasHoldemState {
  const player = state.players[action.playerId];
  const newPlayers = state.players.map(p => ({ ...p }));
  const newPlayer = newPlayers[action.playerId];
  let newBetting = { ...state.betting };

  switch (action.type) {
    case 'fold':
      newPlayer.status = 'folded';
      newPlayer.holeCards = null;
      break;

    case 'check':
      newPlayer.hasActed = true;
      newPlayer.status = 'acted';
      break;

    case 'call': {
      const toCall = state.betting.currentBet - player.currentBet;
      const actualCall = Math.min(toCall, player.chips);

      newPlayer.chips -= actualCall;
      newPlayer.currentBet += actualCall;
      newPlayer.totalInvested += actualCall;
      newPlayer.hasActed = true;
      newPlayer.status = newPlayer.chips === 0 ? 'all_in' : 'acted';
      break;
    }

    case 'bet':
    case 'raise': {
      const amount = action.amount!;
      const toAdd = amount - player.currentBet;
      const raiseAmount = amount - state.betting.currentBet;

      newPlayer.chips -= toAdd;
      newPlayer.currentBet = amount;
      newPlayer.totalInvested += toAdd;
      newPlayer.hasActed = true;
      newPlayer.status = newPlayer.chips === 0 ? 'all_in' : 'acted';

      newBetting = {
        ...state.betting,
        currentBet: amount,
        minRaise: Math.max(state.betting.minRaise, raiseAmount),
        lastRaiser: action.playerId,
        numRaises: state.betting.numRaises + 1,
        lastAction: action,
      };

      // Reset hasActed for other players (they may need to act again)
      newPlayers.forEach((p, i) => {
        if (i !== action.playerId && p.status !== 'folded' && p.status !== 'all_in') {
          newPlayers[i] = { ...p, hasActed: false, status: 'waiting' };
        }
      });
      break;
    }

    case 'all_in': {
      const allInAmount = player.chips + player.currentBet;

      newPlayer.chips = 0;
      newPlayer.currentBet = allInAmount;
      newPlayer.totalInvested = player.totalInvested + player.chips;
      newPlayer.status = 'all_in';
      newPlayer.hasActed = true;

      // Check if this is a raise
      if (allInAmount > state.betting.currentBet) {
        const raiseAmount = allInAmount - state.betting.currentBet;

        // Only counts as a raise if it's at least min raise
        if (raiseAmount >= state.betting.minRaise) {
          newBetting = {
            ...state.betting,
            currentBet: allInAmount,
            minRaise: Math.max(state.betting.minRaise, raiseAmount),
            lastRaiser: action.playerId,
            numRaises: state.betting.numRaises + 1,
            lastAction: action,
          };

          // Reset hasActed for other players
          newPlayers.forEach((p, i) => {
            if (i !== action.playerId && p.status !== 'folded' && p.status !== 'all_in') {
              newPlayers[i] = { ...p, hasActed: false, status: 'waiting' };
            }
          });
        } else {
          // All-in for less than min raise - doesn't reopen betting
          newBetting = {
            ...state.betting,
            currentBet: Math.max(state.betting.currentBet, allInAmount),
            lastAction: action,
          };
        }
      }
      break;
    }
  }

  return {
    ...state,
    players: newPlayers,
    betting: newBetting,
  };
}

export function calculatePots(players: Player[]): Pot[] {
  // Filter to players who have invested chips
  const investingPlayers = players
    .filter(p => p.totalInvested > 0)
    .sort((a, b) => a.totalInvested - b.totalInvested);

  if (investingPlayers.length === 0) return [];

  const pots: Pot[] = [];
  let previousLevel = 0;

  const eligibleForPot = (minInvestment: number): number[] => {
    return players
      .filter(p => p.totalInvested >= minInvestment && p.status !== 'folded')
      .map(p => p.id);
  };

  // Create pots at each "level" of investment
  const levels = [...new Set(investingPlayers.map(p => p.totalInvested))].sort((a, b) => a - b);

  for (const level of levels) {
    const contributorsAtLevel = players.filter(p => p.totalInvested >= level).length;
    const potAmount = (level - previousLevel) * contributorsAtLevel;

    if (potAmount > 0) {
      pots.push({
        amount: potAmount,
        eligiblePlayers: eligibleForPot(level),
        isMain: pots.length === 0,
      });
    }

    previousLevel = level;
  }

  return pots;
}

export function transitionStreet(state: TexasHoldemState): TexasHoldemState {
  // Collect bets into pots
  const pots = calculatePots(state.players);

  // Reset current bets
  const newPlayers = state.players.map(p => ({
    ...p,
    currentBet: 0,
    hasActed: false,
    status: p.status === 'folded' || p.status === 'sitting_out' || p.status === 'all_in'
      ? p.status
      : 'waiting' as const,
  }));

  // Determine next street
  const streetOrder: Street[] = ['preflop', 'flop', 'turn', 'river'];
  const currentIndex = streetOrder.indexOf(state.betting.street);
  const nextStreet = streetOrder[currentIndex + 1];

  if (!nextStreet) {
    // Go to showdown
    return {
      ...state,
      players: newPlayers,
      pots,
      isHandComplete: true,
      currentPlayer: null,
    };
  }

  // Deal community cards
  let newCommunityCards = [...state.communityCards];
  let newDeck = [...state.deck];
  let newBurnCards = [...state.burnCards];

  // Burn one card
  const burnCard = newDeck.pop();
  if (burnCard) {
    newBurnCards.push(burnCard);
  }

  // Deal appropriate number of cards
  const cardsToDeal = nextStreet === 'flop' ? 3 : 1;
  for (let i = 0; i < cardsToDeal; i++) {
    const card = newDeck.pop();
    if (card) {
      newCommunityCards.push(card);
    }
  }

  // Find first to act postflop
  const firstToAct = getFirstToAct(newPlayers, state.buttonPosition, 'postflop');

  return {
    ...state,
    players: newPlayers,
    deck: newDeck,
    communityCards: newCommunityCards,
    burnCards: newBurnCards,
    pots,
    currentPlayer: firstToAct === -1 ? null : firstToAct,
    betting: {
      street: nextStreet,
      currentBet: 0,
      minRaise: state.config.bigBlind,
      lastRaiser: null,
      lastAction: null,
      numRaises: 0,
      potBeforeStreet: pots.reduce((sum, p) => sum + p.amount, 0),
    },
  };
}

/**
 * Get total pot including current bets
 */
export function getTotalPot(state: TexasHoldemState): number {
  const potTotal = state.pots.reduce((sum, p) => sum + p.amount, 0);
  const currentBets = state.players.reduce((sum, p) => sum + p.currentBet, 0);
  return potTotal + currentBets;
}
