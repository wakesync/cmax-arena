/**
 * Core types for CMAX Arena
 * All types must be JSON-serializable
 */

// Player identifier (0-indexed)
export type PlayerId = number;

// Unique match identifier
export type MatchId = string;

// JSON-serializable action (game-specific)
export type Action = string | number | boolean | Record<string, unknown>;

// JSON-serializable observation (game-specific)
export type Observation = Record<string, unknown>;

// JSON-serializable game state (game-specific)
export type GameState = Record<string, unknown>;

// Game configuration (game-specific)
export type GameConfig = Record<string, unknown>;

// Clock information for agents
export interface Clock {
  turnTimeoutMs: number;
  totalTimeRemainingMs?: number;
}

// Budget hooks for LLM cost tracking (future use)
export interface Budget {
  maxTokens?: number;
  maxCostUsd?: number;
}

// Metadata passed to agents
export interface DecideMeta {
  turnIndex: number;
  handNumber?: number;
  budget?: Budget;
}

// Input to agent's decide function
export interface DecideInput {
  matchId: MatchId;
  gameId: string;
  gameVersion: string;
  playerId: PlayerId;
  observation: Observation;
  legalActions: Action[];
  clock: Clock;
  meta: DecideMeta;
}

// Output from agent's decide function
export interface DecideOutput {
  action: Action;
  reason?: string; // Stored but not trusted; sanitize before display
}

// Result of a game step
export interface StepResult {
  state: GameState;
  events?: GameEvent[];
}

// Game-specific event emitted during step
export interface GameEvent {
  type: string;
  data?: Record<string, unknown>;
}

// Player result at end of match
export interface PlayerResult {
  playerId: PlayerId;
  score: number;
  rank: number; // 1 = winner
  stats?: Record<string, unknown>;
}

// Match results
export interface MatchResults {
  players: PlayerResult[];
  winner: PlayerId | null; // null for draws
  isDraw: boolean;
}

// Agent metadata for logging
export interface AgentMeta {
  id: string;
  version: string;
  displayName: string;
  fingerprint: string;
}

// Match configuration
export interface MatchConfig {
  matchId: MatchId;
  gameId: string;
  gameVersion: string;
  seed: string;
  gameConfig?: GameConfig;
  turnTimeoutMs: number;
  agents: AgentMeta[];
}
