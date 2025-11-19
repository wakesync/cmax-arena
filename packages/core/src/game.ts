/**
 * Game definition interface for CMAX Arena disciplines
 */

import type {
  Action,
  GameConfig,
  GameState,
  MatchResults,
  Observation,
  PlayerId,
  StepResult,
} from "./types.js";
import type { Rng } from "./rng.js";

// Number of players specification
export type NumPlayers = number | { min: number; max: number };

// Parameters for reset
export interface ResetParams {
  seed: string;
  config?: GameConfig;
  numPlayers: number;
}

// Parameters for observe
export interface ObserveParams {
  state: GameState;
  playerId: PlayerId;
}

// Parameters for legalActions
export interface LegalActionsParams {
  state: GameState;
  playerId: PlayerId;
}

// Parameters for step
export interface StepParams {
  state: GameState;
  playerId: PlayerId;
  action: Action;
  rng: Rng;
}

/**
 * GameDefinition interface - implement this to create a new discipline
 *
 * All methods must be pure and deterministic. Game state, observations,
 * and actions must be JSON-serializable.
 */
export interface GameDefinition<
  S extends GameState = GameState,
  A extends Action = Action,
  O extends Observation = Observation,
  C extends GameConfig = GameConfig,
> {
  // Stable identifier (e.g., "rps", "kuhn_poker")
  readonly id: string;

  // Semver version string
  readonly version: string;

  // Number of players (fixed or range)
  readonly numPlayers: NumPlayers;

  /**
   * Initialize game state from seed and config
   */
  reset(params: ResetParams & { config?: C }): S;

  /**
   * Get player's observation of current state
   * Should hide private information from other players
   */
  observe(params: ObserveParams & { state: S }): O;

  /**
   * Get list of legal actions for player
   */
  legalActions(params: LegalActionsParams & { state: S }): A[];

  /**
   * Get the player who should act next
   * Returns null if game is terminal
   */
  currentPlayer(state: S): PlayerId | null;

  /**
   * Apply action and return new state with any events
   * Must be deterministic given the same RNG
   */
  step(params: StepParams & { state: S; action: A }): StepResult & { state: S };

  /**
   * Check if game has ended
   */
  isTerminal(state: S): boolean;

  /**
   * Get final results (only valid when isTerminal is true)
   */
  getResults(state: S): MatchResults;
}

/**
 * Helper to validate number of players against game definition
 */
export function validateNumPlayers(
  numPlayers: NumPlayers,
  requested: number
): boolean {
  if (typeof numPlayers === "number") {
    return requested === numPlayers;
  }
  return requested >= numPlayers.min && requested <= numPlayers.max;
}

/**
 * Helper to compare actions for equality
 */
export function actionEquals(a: Action, b: Action): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Helper to check if action is in list of legal actions
 */
export function isLegalAction(action: Action, legalActions: Action[]): boolean {
  return legalActions.some((legal) => actionEquals(action, legal));
}
