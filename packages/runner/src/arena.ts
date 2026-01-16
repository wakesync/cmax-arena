/**
 * Arena - Bridge to cmax-arena Framework
 *
 * Imports games and agents from the monorepo packages
 * and provides a unified interface for running matches.
 *
 * Supports multiple agent types:
 * - local: Built-in agents (random, rule-based)
 * - llm: LLM agents via OpenRouter
 * - webhook: External HTTP endpoints
 * - framework: Agent framework adapters (future)
 */

import { games, getGame } from "@cmax/games";
import {
  agents,
  getAgent,
  createOpenRouterAgent,
  createWebhookAgent,
  getGameSystemPrompt,
} from "@cmax/agents";
import {
  runMatch as coreRunMatch,
  type Agent,
  type MatchEvent,
  type AgentConfiguration,
} from "@cmax/core";

export interface AgentDefinition {
  id: string;
  displayName?: string;
  kind: string;
  config: AgentConfiguration;
}

export interface RunMatchParams {
  gameId: string;
  agents: AgentDefinition[];
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
function createAgentInstance(agentDef: AgentDefinition, gameId: string): Agent {
  const { id, displayName, kind, config } = agentDef;

  // Local built-in agent
  if (kind === "local") {
    const agent = getAgent(id);
    if (!agent) {
      throw new Error(`Unknown local agent: ${id}`);
    }
    return agent;
  }

  // LLM agent via OpenRouter
  if (kind === "llm") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY required for LLM agents");
    }

    const model = config.modelId || "anthropic/claude-3.5-sonnet";
    const temperature = config.temperature ?? 0.2;
    const maxTokens = config.maxTokens ?? 50;

    // Get game-specific system prompt if available
    let systemPrompt = config.systemPrompt;
    if (!systemPrompt) {
      // Check for game-specific prompt in config
      const gamePrompts = config.gamePrompts;
      if (gamePrompts && gamePrompts[gameId]?.systemPrompt) {
        systemPrompt = gamePrompts[gameId].systemPrompt;
      } else {
        // Fall back to default game prompt
        systemPrompt = getGameSystemPrompt(gameId);
      }
    }

    return createOpenRouterAgent({
      apiKey,
      model,
      temperature,
      maxTokens,
      systemPrompt,
    });
  }

  // Webhook agent - external HTTP endpoint
  if (kind === "webhook") {
    if (!config.endpoint) {
      throw new Error("Webhook agent requires endpoint in config");
    }

    return createWebhookAgent({
      id,
      displayName,
      endpoint: config.endpoint,
      authHeader: config.authHeader,
      authToken: config.authToken,
      timeoutMs: config.timeoutMs,
      retries: config.retries,
      webhookSecret: config.webhookSecret,
    });
  }

  // Framework agent - for future use
  if (kind === "framework") {
    throw new Error(`Framework agents not yet implemented: ${config.framework}`);
  }

  throw new Error(`Unknown agent kind: ${kind}`);
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

  // Create agent instances with game context for proper prompts
  const matchAgents: Agent[] = params.agents.map((agentDef) =>
    createAgentInstance(agentDef, params.gameId)
  );

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
