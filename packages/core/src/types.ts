/**
 * Core types for CMAX Arena
 * All types must be JSON-serializable
 */

// Player identifier (0-indexed)
export type PlayerId = number;

// Unique match identifier
export type MatchId = string;

// JSON-serializable action (game-specific)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Action = any;

// JSON-serializable observation (game-specific)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Observation = any;

// JSON-serializable game state (game-specific)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GameState = any;

// Game configuration (game-specific)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GameConfig = any;

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

// ============================================================================
// Agent Configuration Types (for database storage and instantiation)
// ============================================================================

/**
 * LLM Agent Configuration
 * Uses OpenRouter API to call any supported LLM model
 */
export interface LLMAgentConfig {
  modelId: string; // e.g., "anthropic/claude-3.5-sonnet"
  temperature?: number; // 0.0 - 1.0, default 0.3
  maxTokens?: number; // Default 50
  systemPrompt?: string; // Override default system prompt
  gamePrompts?: Record<string, GamePromptConfig>; // Game-specific prompts
}

/**
 * Game-specific prompt configuration
 */
export interface GamePromptConfig {
  systemPrompt?: string; // Game-specific system prompt
  observationFormatter?: string; // Template for formatting observations
  temperature?: number; // Override temperature for this game
}

/**
 * Webhook Agent Configuration
 * External HTTP endpoints that respond to game observations
 */
export interface WebhookAgentConfig {
  endpoint: string; // HTTPS URL
  authHeader?: string; // Optional auth header name (e.g., "Authorization")
  authToken?: string; // Optional auth token (stored encrypted)
  timeoutMs?: number; // Max response time, default 10000
  retries?: number; // Retry count on failure, default 1
  webhookSecret?: string; // Secret for HMAC signature verification
}

/**
 * Framework Agent Configuration
 * Adapters for popular agent frameworks
 */
export interface FrameworkAgentConfig {
  framework: "eliza" | "langchain" | "autogpt" | "crewai";
  frameworkConfig: Record<string, unknown>; // Framework-specific config
  endpoint?: string; // For self-hosted framework instances
  characterFile?: string; // For Eliza: character JSON
}

/**
 * Unified Agent Configuration
 * Used for storing agent configs in the database
 */
export interface AgentConfiguration {
  // For LLM agents
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  gamePrompts?: Record<string, GamePromptConfig>;

  // For webhook agents
  endpoint?: string;
  authHeader?: string;
  authToken?: string;
  timeoutMs?: number;
  retries?: number;
  webhookSecret?: string;

  // For framework agents
  framework?: string;
  frameworkConfig?: Record<string, unknown>;
  characterFile?: string;
}

/**
 * Webhook Request Format
 * Sent from arena to webhook agent endpoints
 */
export interface WebhookRequest {
  // Request metadata
  requestId: string;
  timestamp: string;

  // Match context
  matchId: MatchId;
  gameId: string;
  roundNumber: number;

  // Player info
  playerId: PlayerId;

  // Game observation and legal actions
  observation: Observation;
  legalActions: Action[];

  // Optional opponent info (if visible)
  opponent?: {
    agentId: string;
    displayName: string;
  };
}

/**
 * Webhook Response Format
 * Expected response from webhook agent endpoints
 */
export interface WebhookResponse {
  // Must echo the request ID
  requestId: string;

  // The chosen action
  action: Action;

  // Optional: reasoning/explanation (logged but not used in game logic)
  reasoning?: string;

  // Optional: confidence score (0-1)
  confidence?: number;

  // Optional: timing info from agent's perspective
  thinkTimeMs?: number;
}
