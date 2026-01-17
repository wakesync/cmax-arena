/**
 * Drama Detection System
 *
 * Detects exciting moments in matches for table talk triggers
 * and clip generation.
 */

import type {
  DramaEvent,
  DramaType,
  GameState,
  Action,
  HandResult,
} from "./types.js";

/**
 * Configuration for drama detection thresholds
 */
export interface DramaConfig {
  /** Pot size threshold for "huge pot" (relative to total chips) */
  hugePotThreshold: number;
  /** Chip threshold for "comeback" detection */
  comebackThreshold: number;
  /** Minimum pot growth ratio for "huge pot" */
  potGrowthRatio: number;
}

const DEFAULT_CONFIG: DramaConfig = {
  hugePotThreshold: 5000,
  comebackThreshold: 2000,
  potGrowthRatio: 3,
};

/**
 * Detect drama events from game state transitions
 */
export function detectDrama(
  previousState: GameState,
  currentState: GameState,
  action: Action,
  handResult?: HandResult,
  config: DramaConfig = DEFAULT_CONFIG
): DramaEvent[] {
  const events: DramaEvent[] = [];
  const timestamp = Date.now();

  // Get the acting player
  const actingPlayer = currentState.players.find((p) => p.id === action.playerId);
  if (!actingPlayer) return events;

  // ========================================
  // ALL-IN DETECTION
  // ========================================
  if (action.type === "all_in" || action.type === "all-in") {
    const amount = action.amount || actingPlayer.totalInvested;
    const isHugeAllIn = amount > currentState.pot * 0.5;
    const severity: 1 | 2 | 3 = isHugeAllIn ? 3 : amount > 2000 ? 2 : 1;

    events.push({
      type: "all_in",
      severity,
      description: `${actingPlayer.agentId} GOES ALL IN for $${amount.toLocaleString()}!`,
      involvedPlayers: [actingPlayer.agentId],
      clipWorthy: severity >= 2,
      timestamp,
      metadata: { amount, pot: currentState.pot },
    });
  }

  // ========================================
  // HUGE POT DETECTION
  // ========================================
  const potGrowth = currentState.pot / Math.max(previousState.pot, 1);
  if (
    potGrowth > config.potGrowthRatio &&
    currentState.pot > config.hugePotThreshold
  ) {
    const activePlayers = currentState.players
      .filter((p) => p.status !== "folded" && p.status !== "out")
      .map((p) => p.agentId);

    events.push({
      type: "huge_pot",
      severity: currentState.pot > 10000 ? 3 : 2,
      description: `POT EXPLODES to $${currentState.pot.toLocaleString()}!`,
      involvedPlayers: activePlayers,
      clipWorthy: currentState.pot > 10000,
      timestamp,
      metadata: { previousPot: previousState.pot, currentPot: currentState.pot },
    });
  }

  // ========================================
  // HAND RESULT DRAMA
  // ========================================
  if (handResult) {
    // BAD BEAT
    if (handResult.isBadBeat && handResult.loser) {
      events.push({
        type: "bad_beat",
        severity: 3,
        description: `BAD BEAT! ${handResult.loser.agentId} had ${
          handResult.loserHand?.description || "a strong hand"
        } but ${handResult.winner.agentId} hits ${
          handResult.winnerHand?.description || "a better hand"
        } on the river!`,
        involvedPlayers: [handResult.winner.agentId, handResult.loser.agentId],
        clipWorthy: true,
        timestamp,
        metadata: handResult as unknown as Record<string, unknown>,
      });
    }

    // COOLER (both players have monster hands)
    if (handResult.isCooler && handResult.loser) {
      events.push({
        type: "cooler",
        severity: 3,
        description: `COOLER! ${handResult.loserHand?.description || "Monster hand"} vs ${
          handResult.winnerHand?.description || "Even bigger monster"
        }!`,
        involvedPlayers: [handResult.winner.agentId, handResult.loser.agentId],
        clipWorthy: true,
        timestamp,
        metadata: handResult as unknown as Record<string, unknown>,
      });
    }

    // SUCCESSFUL BLUFF
    if (handResult.wasBluff && handResult.bluffSucceeded && handResult.bluffer) {
      events.push({
        type: "bluff_success",
        severity: 2,
        description: `${handResult.bluffer} pulls off the BLUFF with ${
          handResult.blufferHand || "nothing"
        }!`,
        involvedPlayers: [handResult.bluffer],
        clipWorthy: handResult.potSize > 5000,
        timestamp,
        metadata: handResult as unknown as Record<string, unknown>,
      });
    }

    // HERO CALL
    if (handResult.wasHeroCall && handResult.caller && handResult.bluffer) {
      events.push({
        type: "hero_call",
        severity: 3,
        description: `HERO CALL! ${handResult.caller} looks into ${
          handResult.bluffer
        }'s soul and calls with ${handResult.callerHand?.description || "a marginal hand"}!`,
        involvedPlayers: [handResult.caller, handResult.bluffer],
        clipWorthy: true,
        timestamp,
        metadata: handResult as unknown as Record<string, unknown>,
      });
    }

    // COMEBACK
    const winnerBefore = previousState.players.find(
      (p) => p.agentId === handResult.winner.agentId
    );
    if (winnerBefore) {
      const chipsGained = handResult.winner.chipsAfter - winnerBefore.chips;
      const wasShortStack = winnerBefore.chips < config.comebackThreshold;
      const nowHealthy = handResult.winner.chipsAfter > config.comebackThreshold * 2;

      if (wasShortStack && nowHealthy) {
        events.push({
          type: "comeback",
          severity: 2,
          description: `${handResult.winner.agentId} DOUBLES UP from $${winnerBefore.chips.toLocaleString()} to $${handResult.winner.chipsAfter.toLocaleString()}!`,
          involvedPlayers: [handResult.winner.agentId],
          clipWorthy: true,
          timestamp,
          metadata: {
            before: winnerBefore.chips,
            after: handResult.winner.chipsAfter,
            gained: chipsGained,
          },
        });
      }
    }
  }

  return events;
}

/**
 * Check if an action is likely a bluff based on bet sizing
 */
export function isLikelyBluff(
  action: Action,
  state: GameState,
  playerId: number
): boolean {
  if (action.type !== "bet" && action.type !== "raise") {
    return false;
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;

  // Overbet (bet > pot) is often a bluff
  const betAmount = action.amount || 0;
  if (betAmount > state.pot * 1.5) {
    return true;
  }

  return false;
}

/**
 * Calculate drama severity for an event
 */
export function calculateDramaSeverity(
  event: Partial<DramaEvent>,
  state: GameState
): 1 | 2 | 3 {
  // All-ins and bad beats are always high drama
  if (event.type === "all_in" || event.type === "bad_beat" || event.type === "cooler") {
    return 3;
  }

  // Large pots increase drama
  if (state.pot > 10000) {
    return 3;
  }
  if (state.pot > 5000) {
    return 2;
  }

  return 1;
}

/**
 * Get a human-readable description for a drama type
 */
export function getDramaDescription(type: DramaType): string {
  const descriptions: Record<DramaType, string> = {
    all_in: "All-In Confrontation",
    bad_beat: "Bad Beat",
    huge_pot: "Massive Pot",
    comeback: "Comeback",
    bluff_success: "Successful Bluff",
    bluff_caught: "Bluff Caught",
    soul_read: "Soul Read",
    cooler: "Cooler",
    river_drama: "River Drama",
    hero_call: "Hero Call",
    hero_fold: "Hero Fold",
  };

  return descriptions[type] || type;
}

/**
 * Filter drama events to only clip-worthy ones
 */
export function getClipWorthyEvents(events: DramaEvent[]): DramaEvent[] {
  return events.filter((e) => e.clipWorthy);
}

/**
 * Sort drama events by severity (highest first)
 */
export function sortBySeverity(events: DramaEvent[]): DramaEvent[] {
  return [...events].sort((a, b) => b.severity - a.severity);
}
