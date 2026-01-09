/**
 * Arena - Bridge to cmax-arena Framework
 *
 * Imports games and agents from the monorepo packages
 * and provides a unified interface for running matches.
 */

import { games, getGame } from "@cmax/games";
import {
  agents,
  getAgent,
  createOpenRouterAgent,
} from "@cmax/agents";
import {
  runMatch as coreRunMatch,
  type Agent,
  type MatchEvent,
} from "@cmax/core";

export interface RunMatchParams {
  gameId: string;
  agents: Array<{
    id: string;
    kind: string;
    config: Record<string, unknown>;
  }>;
  seed: string;
  config?: Record<string, unknown>;
  onEvent: (
    event: MatchEvent,
    sequence: number
  ) => Promise<void>;
}

export interface MatchResult {
  winner: number | null;
  isDraw: boolean;
  players: Array<{ playerId: number; score: number; rank: number }>;
  log: string;
}

/**
 * Create an agent instance from database agent definition
 */
function createAgentInstance(agentDef: {
  id: string;
  kind: string;
  config: Record<string, unknown>;
}): Agent {
  // Local built-in agent
  if (agentDef.kind === "local") {
    const agent = getAgent(agentDef.id);
    if (!agent) {
      throw new Error(`Unknown local agent: ${agentDef.id}`);
    }
    return agent;
  }

  // LLM agent via OpenRouter
  if (agentDef.kind === "llm") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY required for LLM agents");
    }

    const model = (agentDef.config.model as string) || "anthropic/claude-3.5-sonnet";
    const temperature = (agentDef.config.temperature as number) || 0.2;

    return createOpenRouterAgent({
      apiKey,
      model,
      temperature,
    });
  }

  throw new Error(`Unknown agent kind: ${agentDef.kind}`);
}

/**
 * Run a match using the cmax-arena framework
 */
export async function runMatchWithGame(
  params: RunMatchParams
): Promise<MatchResult> {
  const game = getGame(params.gameId);
  if (!game) {
    throw new Error(`Unknown game: ${params.gameId}`);
  }

  // Create agent instances
  const matchAgents: Agent[] = params.agents.map(createAgentInstance);

  // Track events and log lines
  const logLines: string[] = [];
  let sequence = 0;

  // Run the match
  const report = await coreRunMatch(game, matchAgents, {
    seed: params.seed,
    gameConfig: params.config,
    onEvent: async (event: MatchEvent) => {
      // Add to log
      logLines.push(
        JSON.stringify({
          seq: sequence,
          type: event.type,
          data: event,
          ts: Date.now(),
        })
      );

      // Stream to Supabase
      await params.onEvent(event, sequence);
      sequence++;
    },
  });

  return {
    winner: report.results.winner ?? null,
    isDraw: report.results.isDraw,
    players: report.results.players,
    log: logLines.join("\n"),
  };
}

/**
 * Get list of available games
 */
export function getAvailableGames(): string[] {
  return Object.keys(games);
}

/**
 * Get list of available local agents
 */
export function getAvailableAgents(): string[] {
  return Object.keys(agents);
}
