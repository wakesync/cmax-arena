/**
 * Match orchestrator - runs the game loop
 */

import { createRng, type Rng } from "./rng.js";
import { commitSeed, agentFingerprint, hashObject } from "./crypto.js";
import { isLegalAction, type GameDefinition } from "./game.js";
import type { Agent } from "./agent.js";
import type {
  Action,
  AgentMeta,
  DecideInput,
  GameConfig,
  GameState,
  MatchConfig,
  MatchId,
  MatchResults,
  PlayerId,
} from "./types.js";

// Event types for logging
export interface MatchStartEvent {
  type: "MATCH_START";
  matchId: MatchId;
  startedAt: string;
  gameId: string;
  gameVersion: string;
  agents: AgentMeta[];
  seedCommit: string;
  config?: GameConfig;
}

export interface TurnEvent {
  type: "TURN";
  turnIndex: number;
  playerId: PlayerId;
  observationHash: string;
  action: Action;
  timingMs: number;
  timedOut: boolean;
  illegalAction: boolean;
  originalAction?: Action;
  events?: Array<{ type: string; data?: Record<string, unknown> }>;
}

export interface MatchEndEvent {
  type: "MATCH_END";
  seedReveal: string;
  results: MatchResults;
  totalTurns: number;
  totalTimeMs: number;
}

export type MatchEvent = MatchStartEvent | TurnEvent | MatchEndEvent;

// Match report
export interface MatchReport {
  matchId: MatchId;
  gameId: string;
  gameVersion: string;
  results: MatchResults;
  events: MatchEvent[];
  agents: AgentMeta[];
  seed: string;
  seedCommit: string;
  totalTurns: number;
  totalTimeMs: number;
}

// Orchestrator options
export interface OrchestratorOptions {
  matchId?: MatchId;
  seed: string;
  turnTimeoutMs?: number;
  gameConfig?: GameConfig;
  onEvent?: (event: MatchEvent) => void;
}

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Generate a unique match ID
 */
function generateMatchId(): MatchId {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `match_${timestamp}_${random}`;
}

/**
 * Run a single decision with timeout
 */
async function decideWithTimeout(
  agent: Agent,
  input: DecideInput,
  timeoutMs: number
): Promise<{ action: Action; timedOut: boolean; timingMs: number }> {
  const startTime = performance.now();

  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });

  const decidePromise = agent.decide(input).then((result) => result.action);

  const result = await Promise.race([decidePromise, timeoutPromise]);
  const timingMs = performance.now() - startTime;

  if (result === null) {
    return { action: input.legalActions[0], timedOut: true, timingMs };
  }

  return { action: result, timedOut: false, timingMs };
}

/**
 * Run a match between agents on a game
 */
export async function runMatch<S extends GameState = GameState>(
  game: GameDefinition<S>,
  agents: Agent[],
  options: OrchestratorOptions
): Promise<MatchReport> {
  const matchId = options.matchId ?? generateMatchId();
  const seed = options.seed;
  const turnTimeoutMs = options.turnTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const seedCommit = commitSeed(seed);
  const matchStartTime = performance.now();

  // Create RNG
  const rng: Rng = createRng(seed);

  // Build agent metadata
  const agentMetas: AgentMeta[] = agents.map((a) => ({
    id: a.id,
    version: a.version,
    displayName: a.displayName,
    fingerprint: agentFingerprint({ id: a.id, version: a.version, config: a.config }),
  }));

  // Initialize events
  const events: MatchEvent[] = [];

  // Match start event
  const startEvent: MatchStartEvent = {
    type: "MATCH_START",
    matchId,
    startedAt: new Date().toISOString(),
    gameId: game.id,
    gameVersion: game.version,
    agents: agentMetas,
    seedCommit,
    config: options.gameConfig,
  };
  events.push(startEvent);
  options.onEvent?.(startEvent);

  // Initialize game state
  let state = game.reset({
    seed,
    config: options.gameConfig,
    numPlayers: agents.length,
  });

  let turnIndex = 0;

  // Game loop
  while (!game.isTerminal(state)) {
    const playerId = game.currentPlayer(state);
    if (playerId === null) break;

    const agent = agents[playerId];
    const observation = game.observe({ state, playerId });
    const legalActions = game.legalActions({ state, playerId });

    // Build decide input
    const decideInput: DecideInput = {
      matchId,
      gameId: game.id,
      gameVersion: game.version,
      playerId,
      observation,
      legalActions,
      clock: {
        turnTimeoutMs,
      },
      meta: {
        turnIndex,
      },
    };

    // Get agent decision with timeout
    const { action: rawAction, timedOut, timingMs } = await decideWithTimeout(
      agent,
      decideInput,
      turnTimeoutMs
    );

    // Validate action
    let action = rawAction;
    let illegalAction = false;
    let originalAction: Action | undefined;

    if (!isLegalAction(action, legalActions)) {
      illegalAction = true;
      originalAction = action;
      action = legalActions[0]; // Fallback to first legal action
    }

    // Apply action
    const stepResult = game.step({
      state,
      playerId,
      action,
      rng,
    });
    state = stepResult.state;

    // Create turn event
    const turnEvent: TurnEvent = {
      type: "TURN",
      turnIndex,
      playerId,
      observationHash: hashObject(observation),
      action,
      timingMs,
      timedOut,
      illegalAction,
      originalAction: illegalAction ? originalAction : undefined,
      events: stepResult.events,
    };
    events.push(turnEvent);
    options.onEvent?.(turnEvent);

    turnIndex++;
  }

  // Get results
  const results = game.getResults(state);
  const totalTimeMs = performance.now() - matchStartTime;

  // Match end event
  const endEvent: MatchEndEvent = {
    type: "MATCH_END",
    seedReveal: seed,
    results,
    totalTurns: turnIndex,
    totalTimeMs,
  };
  events.push(endEvent);
  options.onEvent?.(endEvent);

  return {
    matchId,
    gameId: game.id,
    gameVersion: game.version,
    results,
    events,
    agents: agentMetas,
    seed,
    seedCommit,
    totalTurns: turnIndex,
    totalTimeMs,
  };
}

/**
 * Get match configuration from report
 */
export function getMatchConfig(report: MatchReport): MatchConfig {
  const startEvent = report.events.find(
    (e): e is MatchStartEvent => e.type === "MATCH_START"
  );

  return {
    matchId: report.matchId,
    gameId: report.gameId,
    gameVersion: report.gameVersion,
    seed: report.seed,
    gameConfig: startEvent?.config,
    turnTimeoutMs: DEFAULT_TIMEOUT_MS,
    agents: report.agents,
  };
}
