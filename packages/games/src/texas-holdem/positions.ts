/**
 * Position Management
 */

import type { Player, PositionName } from './types.js';

export function getButtonPosition(players: Player[], previousButton: number): number {
  // Move button to next active player
  const numPlayers = players.length;
  let newButton = (previousButton + 1) % numPlayers;

  while (players[newButton].status === 'sitting_out') {
    newButton = (newButton + 1) % numPlayers;
  }

  return newButton;
}

export function getBlindPositions(buttonPos: number, numPlayers: number): {
  smallBlind: number;
  bigBlind: number;
} {
  if (numPlayers === 2) {
    // Heads-up: button is small blind
    return {
      smallBlind: buttonPos,
      bigBlind: (buttonPos + 1) % 2,
    };
  }

  return {
    smallBlind: (buttonPos + 1) % numPlayers,
    bigBlind: (buttonPos + 2) % numPlayers,
  };
}

export function getPositionName(
  seatIndex: number,
  buttonPos: number,
  numPlayers: number
): PositionName {
  const relativePos = (seatIndex - buttonPos + numPlayers) % numPlayers;

  if (numPlayers === 2) {
    return relativePos === 0 ? 'BTN' : 'BB';
  }

  const positions: Record<number, PositionName[]> = {
    3: ['BTN', 'SB', 'BB'],
    4: ['BTN', 'SB', 'BB', 'UTG'],
    5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
    6: ['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO'],
  };

  return positions[numPlayers]?.[relativePos] || 'MP';
}

export function getFirstToAct(
  players: Player[],
  buttonPos: number,
  street: 'preflop' | 'postflop'
): number {
  const numPlayers = players.length;
  const activePlayers = players.filter(p =>
    p.status !== 'folded' && p.status !== 'sitting_out'
  );

  if (activePlayers.length <= 1) return -1; // Hand is over

  if (street === 'preflop') {
    // First to act is UTG (after big blind)
    const { bigBlind } = getBlindPositions(buttonPos, numPlayers);
    let firstToAct = (bigBlind + 1) % numPlayers;

    while (players[firstToAct].status === 'folded' ||
           players[firstToAct].status === 'sitting_out' ||
           players[firstToAct].status === 'all_in') {
      firstToAct = (firstToAct + 1) % numPlayers;
      if (firstToAct === bigBlind) return -1; // Everyone all-in or folded
    }

    return firstToAct;
  }

  // Postflop: first active player after button
  let firstToAct = (buttonPos + 1) % numPlayers;

  while (players[firstToAct].status === 'folded' ||
         players[firstToAct].status === 'sitting_out' ||
         players[firstToAct].status === 'all_in') {
    firstToAct = (firstToAct + 1) % numPlayers;
    if (firstToAct === buttonPos) return -1;
  }

  return firstToAct;
}

export function getNextToAct(
  players: Player[],
  currentPlayer: number,
  lastRaiser: number | null
): number | null {
  const numPlayers = players.length;
  let next = (currentPlayer + 1) % numPlayers;

  // Find next player who can act
  for (let i = 0; i < numPlayers; i++) {
    const player = players[next];

    // Skip inactive players
    if (player.status === 'folded' ||
        player.status === 'sitting_out' ||
        player.status === 'all_in') {
      next = (next + 1) % numPlayers;
      continue;
    }

    // If we've gone full circle back to last raiser, betting is done
    if (lastRaiser !== null && next === lastRaiser) {
      return null;
    }

    // If player hasn't acted yet, or needs to respond to a raise
    if (!player.hasActed) {
      return next;
    }

    next = (next + 1) % numPlayers;
  }

  return null; // Betting complete
}

/**
 * Count players who can still act in a betting round
 */
export function countActivePlayers(players: Player[]): number {
  return players.filter(p =>
    p.status !== 'folded' && p.status !== 'sitting_out'
  ).length;
}

/**
 * Count players who can still bet (not folded, not all-in)
 */
export function countPlayersAbleToAct(players: Player[]): number {
  return players.filter(p =>
    p.status !== 'folded' && p.status !== 'sitting_out' && p.status !== 'all_in'
  ).length;
}
