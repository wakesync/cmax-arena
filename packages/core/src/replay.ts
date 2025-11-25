/**
 * Replay and determinism verification
 */

import { createRng } from "./rng.js";
import { verifySeed, hashObject } from "./crypto.js";
import { isLegalAction, type GameDefinition } from "./game.js";
import type {
  MatchEvent,
  MatchStartEvent,
  TurnEvent,
  MatchEndEvent,
} from "./orchestrator.js";
import type { GameState, Action, MatchResults } from "./types.js";

// Verification result
export interface ReplayResult {
  success: boolean;
  matchId: string;
  errors: ReplayError[];
  turnsVerified: number;
  totalTurns: number;
}

// Types of replay errors
export type ReplayErrorType =
  | "SEED_MISMATCH"
  | "ACTION_ILLEGAL"
  | "OBSERVATION_HASH_MISMATCH"
  | "RESULTS_MISMATCH"
  | "MISSING_EVENT"
  | "STATE_ERROR";

export interface ReplayError {
  type: ReplayErrorType;
  turnIndex?: number;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

/**
 * Replay a match and verify determinism
 *
 * @param game The game definition to use
 * @param events The events from the match log
 * @param verifyObservations Whether to verify observation hashes (default: true)
 * @returns ReplayResult with success status and any errors
 */
export function replayMatch<S extends GameState = GameState>(
  game: GameDefinition<S>,
  events: MatchEvent[],
  verifyObservations: boolean = true
): ReplayResult {
  const errors: ReplayError[] = [];

  // Find start and end events
  const startEvent = events.find((e): e is MatchStartEvent => e.type === "MATCH_START");
  const endEvent = events.find((e): e is MatchEndEvent => e.type === "MATCH_END");
  const turnEvents = events.filter((e): e is TurnEvent => e.type === "TURN");

  if (!startEvent) {
    return {
      success: false,
      matchId: "unknown",
      errors: [{ type: "MISSING_EVENT", message: "Missing MATCH_START event" }],
      turnsVerified: 0,
      totalTurns: 0,
    };
  }

  if (!endEvent) {
    return {
      success: false,
      matchId: startEvent.matchId,
      errors: [{ type: "MISSING_EVENT", message: "Missing MATCH_END event" }],
      turnsVerified: 0,
      totalTurns: turnEvents.length,
    };
  }

  // Verify seed
  const seed = endEvent.seedReveal;
  if (!verifySeed(seed, startEvent.seedCommit)) {
    errors.push({
      type: "SEED_MISMATCH",
      message: "Seed reveal does not match commitment",
      expected: startEvent.seedCommit,
      actual: seed,
    });
  }

  // Create RNG and initialize state
  const rng = createRng(seed);
  let state: S;

  try {
    state = game.reset({
      seed,
      config: startEvent.config,
      numPlayers: startEvent.agents.length,
    });
  } catch (err) {
    errors.push({
      type: "STATE_ERROR",
      message: `Failed to reset game: ${err}`,
    });
    return {
      success: false,
      matchId: startEvent.matchId,
      errors,
      turnsVerified: 0,
      totalTurns: turnEvents.length,
    };
  }

  // Replay each turn
  let turnsVerified = 0;

  for (const turnEvent of turnEvents) {
    const playerId = turnEvent.playerId;

    // Verify observation hash if enabled
    if (verifyObservations) {
      try {
        const observation = game.observe({ state, playerId });
        const observationHash = hashObject(observation);

        if (observationHash !== turnEvent.observationHash) {
          errors.push({
            type: "OBSERVATION_HASH_MISMATCH",
            turnIndex: turnEvent.turnIndex,
            message: `Observation hash mismatch at turn ${turnEvent.turnIndex}`,
            expected: turnEvent.observationHash,
            actual: observationHash,
          });
        }
      } catch (err) {
        errors.push({
          type: "STATE_ERROR",
          turnIndex: turnEvent.turnIndex,
          message: `Failed to observe at turn ${turnEvent.turnIndex}: ${err}`,
        });
      }
    }

    // Verify action legality
    const legalActions = game.legalActions({ state, playerId });
    const action = turnEvent.action as Action;

    if (!isLegalAction(action, legalActions)) {
      // If the turn already recorded illegal action, this is expected
      if (!turnEvent.illegalAction) {
        errors.push({
          type: "ACTION_ILLEGAL",
          turnIndex: turnEvent.turnIndex,
          message: `Action was recorded as legal but is not legal at turn ${turnEvent.turnIndex}`,
          actual: action,
        });
      }
    }

    // Apply action
    try {
      const stepResult = game.step({
        state,
        playerId,
        action,
        rng,
      });
      state = stepResult.state;
      turnsVerified++;
    } catch (err) {
      errors.push({
        type: "STATE_ERROR",
        turnIndex: turnEvent.turnIndex,
        message: `Failed to apply action at turn ${turnEvent.turnIndex}: ${err}`,
      });
      break;
    }
  }

  // Verify final results
  if (game.isTerminal(state)) {
    try {
      const results = game.getResults(state);
      if (!resultsEqual(results, endEvent.results)) {
        errors.push({
          type: "RESULTS_MISMATCH",
          message: "Final results do not match",
          expected: endEvent.results,
          actual: results,
        });
      }
    } catch (err) {
      errors.push({
        type: "STATE_ERROR",
        message: `Failed to get results: ${err}`,
      });
    }
  }

  return {
    success: errors.length === 0,
    matchId: startEvent.matchId,
    errors,
    turnsVerified,
    totalTurns: turnEvents.length,
  };
}

/**
 * Compare two MatchResults for equality
 */
function resultsEqual(a: MatchResults, b: MatchResults): boolean {
  if (a.winner !== b.winner) return false;
  if (a.isDraw !== b.isDraw) return false;
  if (a.players.length !== b.players.length) return false;

  for (let i = 0; i < a.players.length; i++) {
    const pa = a.players[i];
    const pb = b.players[i];
    if (pa.playerId !== pb.playerId) return false;
    if (pa.score !== pb.score) return false;
    if (pa.rank !== pb.rank) return false;
  }

  return true;
}

/**
 * Quick check if a log file appears valid
 */
export function isValidLogFormat(events: MatchEvent[]): boolean {
  if (!events || events.length < 2) return false;

  const hasStart = events.some((e) => e.type === "MATCH_START");
  const hasEnd = events.some((e) => e.type === "MATCH_END");

  return hasStart && hasEnd;
}
