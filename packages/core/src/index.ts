// @cmax/core - CMAX Arena Core Framework

export const VERSION = "0.1.0";

// Types
export type {
  PlayerId,
  MatchId,
  Action,
  Observation,
  GameState,
  GameConfig,
  Clock,
  Budget,
  DecideMeta,
  DecideInput,
  DecideOutput,
  StepResult,
  GameEvent,
  PlayerResult,
  MatchResults,
  AgentMeta,
  MatchConfig,
} from "./types.js";

// Game
export type {
  NumPlayers,
  ResetParams,
  ObserveParams,
  LegalActionsParams,
  StepParams,
  GameDefinition,
} from "./game.js";
export { validateNumPlayers, actionEquals, isLegalAction } from "./game.js";

// Agent
export type { AgentKind, Agent, AgentFactory, AgentRegistry } from "./agent.js";
export { createAgentRegistry } from "./agent.js";

// RNG
export { createRng } from "./rng.js";
export type { Rng } from "./rng.js";

// Crypto
export {
  sha256,
  commitSeed,
  verifySeed,
  hashObject,
  agentFingerprint,
} from "./crypto.js";

// Orchestrator
export type {
  MatchStartEvent,
  TurnEvent,
  MatchEndEvent,
  MatchEvent,
  MatchReport,
  OrchestratorOptions,
} from "./orchestrator.js";
export { runMatch, getMatchConfig } from "./orchestrator.js";
