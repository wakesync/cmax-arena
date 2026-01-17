/**
 * Showdown Logic
 */

import type {
  Player, Card, Pot, HandResult, ShowdownInfo, PotDistribution, WinnerInfo
} from './types.js';
import { evaluateHand, findWinners } from './hands.js';

/**
 * Resolve showdown and distribute pots
 */
export function resolveShowdown(
  players: Player[],
  communityCards: Card[],
  pots: Pot[]
): HandResult {
  // Get all players who made it to showdown
  const showdownPlayers = players.filter(
    p => p.status !== 'folded' && p.holeCards !== null
  );

  // Evaluate all hands
  const evaluatedPlayers = showdownPlayers.map(p => ({
    playerId: p.id,
    agentId: p.agentId,
    holeCards: p.holeCards!,
    hand: evaluateHand(p.holeCards!, communityCards),
  }));

  // Distribute each pot
  const potDistributions: PotDistribution[] = [];
  const winnerAmounts: Record<number, number> = {};

  for (let i = 0; i < pots.length; i++) {
    const pot = pots[i];

    // Filter to eligible players
    const eligible = evaluatedPlayers.filter(
      p => pot.eligiblePlayers.includes(p.playerId)
    );

    if (eligible.length === 0) continue;

    if (eligible.length === 1) {
      // Uncontested pot
      const winner = eligible[0];
      winnerAmounts[winner.playerId] = (winnerAmounts[winner.playerId] || 0) + pot.amount;
      potDistributions.push({
        potIndex: i,
        potAmount: pot.amount,
        winners: [winner.playerId],
        winningHand: winner.hand,
      });
      continue;
    }

    // Find best hand(s)
    const winnerIds = findWinners(eligible.map(p => ({ playerId: p.playerId, hand: p.hand })));

    // Split pot among winners
    const splitAmount = Math.floor(pot.amount / winnerIds.length);
    const remainder = pot.amount % winnerIds.length;

    for (let j = 0; j < winnerIds.length; j++) {
      const winnerId = winnerIds[j];
      // First player gets remainder (arbitrary but consistent)
      const amount = splitAmount + (j === 0 ? remainder : 0);
      winnerAmounts[winnerId] = (winnerAmounts[winnerId] || 0) + amount;
    }

    const winningPlayer = evaluatedPlayers.find(p => p.playerId === winnerIds[0]);
    potDistributions.push({
      potIndex: i,
      potAmount: pot.amount,
      winners: winnerIds,
      winningHand: winningPlayer?.hand,
    });
  }

  return {
    winners: Object.entries(winnerAmounts).map(([playerId, amount]) => {
      const player = evaluatedPlayers.find(p => p.playerId === Number(playerId))!;
      return {
        playerId: Number(playerId),
        agentId: player.agentId,
        amountWon: amount,
        hand: player.hand,
      };
    }),
    showdownPlayers: evaluatedPlayers.map(p => ({
      playerId: p.playerId,
      holeCards: p.holeCards,
      bestHand: p.hand,
    })),
    potDistribution: potDistributions,
    handNumber: 0, // Set by caller
  };
}

/**
 * Resolve hand when everyone folds to one player
 */
export function resolveWithoutShowdown(
  winner: Player,
  pots: Pot[]
): HandResult {
  const totalPot = pots.reduce((sum, p) => sum + p.amount, 0);

  return {
    winners: [{
      playerId: winner.id,
      agentId: winner.agentId,
      amountWon: totalPot,
      // No hand shown when everyone folds
    }],
    showdownPlayers: [],
    potDistribution: pots.map((pot, i) => ({
      potIndex: i,
      potAmount: pot.amount,
      winners: [winner.id],
    })),
    handNumber: 0,
  };
}
