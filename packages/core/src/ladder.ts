/**
 * Ladder Runner
 *
 * Runs multiple matches between agents and tracks Elo ratings.
 * Supports round-robin tournaments and custom matchups.
 */

import type { Agent } from "./agent.js";
import type { GameDefinition } from "./game.js";
import type { MatchReport } from "./orchestrator.js";
import { runMatch } from "./orchestrator.js";
import { createEloRatings, type EloConfig, type EloRatings, type PlayerRating } from "./ratings.js";

export interface LadderConfig {
  // Number of matches per agent pair (default: 1)
  matchesPerPair?: number;

  // Elo rating configuration
  elo?: EloConfig;

  // Game-specific configuration
  gameConfig?: Record<string, unknown>;

  // Base seed for deterministic matches
  seed?: string;

  // Callback for match completion
  onMatchComplete?: (result: MatchResult) => void;
}

export interface MatchResult {
  match: MatchReport;
  player1: string;
  player2: string;
  winnerId: string | null;
  ratingUpdate: {
    player1Before: number;
    player1After: number;
    player2Before: number;
    player2After: number;
  };
}

export interface LadderResult {
  matches: MatchResult[];
  ratings: EloRatings;
  leaderboard: PlayerRating[];
  stats: {
    totalMatches: number;
    totalTurns: number;
    totalTimeMs: number;
  };
}

/**
 * Generate all pairs for round-robin
 */
function generateRoundRobinPairs(agents: Agent[]): Array<[Agent, Agent]> {
  const pairs: Array<[Agent, Agent]> = [];
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      pairs.push([agents[i], agents[j]]);
    }
  }
  return pairs;
}

/**
 * Run a ladder (round-robin tournament) between agents
 */
export async function runLadder(
  game: GameDefinition,
  agents: Agent[],
  config: LadderConfig = {}
): Promise<LadderResult> {
  const matchesPerPair = config.matchesPerPair ?? 1;
  const baseSeed = config.seed ?? "ladder";
  const ratings = createEloRatings(config.elo);

  // Initialize all agents in the rating system
  for (const agent of agents) {
    ratings.getRating(agent.id);
  }

  const pairs = generateRoundRobinPairs(agents);
  const matches: MatchResult[] = [];
  let totalTurns = 0;
  let totalTimeMs = 0;

  for (const [agent1, agent2] of pairs) {
    for (let matchNum = 0; matchNum < matchesPerPair; matchNum++) {
      // Alternate who goes first
      const orderedAgents = matchNum % 2 === 0 ? [agent1, agent2] : [agent2, agent1];

      // Generate deterministic seed for this match
      const matchSeed = `${baseSeed}:${agent1.id}:${agent2.id}:${matchNum}`;

      const report = await runMatch(game, orderedAgents, {
        seed: matchSeed,
        gameConfig: config.gameConfig,
      });

      totalTurns += report.totalTurns;
      totalTimeMs += report.totalTimeMs;

      // Determine winner
      let winnerId: string | null = null;
      if (!report.results.isDraw) {
        winnerId = orderedAgents[report.results.winner!].id;
      }

      // Record match result and update ratings
      const p1Rating = ratings.getRating(agent1.id);
      const p2Rating = ratings.getRating(agent2.id);

      ratings.recordMatch(agent1.id, agent2.id, winnerId);

      const result: MatchResult = {
        match: report,
        player1: agent1.id,
        player2: agent2.id,
        winnerId,
        ratingUpdate: {
          player1Before: p1Rating,
          player1After: ratings.getRating(agent1.id),
          player2Before: p2Rating,
          player2After: ratings.getRating(agent2.id),
        },
      };

      matches.push(result);

      if (config.onMatchComplete) {
        config.onMatchComplete(result);
      }
    }
  }

  return {
    matches,
    ratings,
    leaderboard: ratings.getLeaderboard(),
    stats: {
      totalMatches: matches.length,
      totalTurns,
      totalTimeMs,
    },
  };
}

/**
 * Run specific matchups (not round-robin)
 */
export async function runMatchups(
  game: GameDefinition,
  matchups: Array<[Agent, Agent]>,
  config: LadderConfig = {}
): Promise<LadderResult> {
  const baseSeed = config.seed ?? "matchups";
  const ratings = createEloRatings(config.elo);

  const matches: MatchResult[] = [];
  let totalTurns = 0;
  let totalTimeMs = 0;

  for (let i = 0; i < matchups.length; i++) {
    const [agent1, agent2] = matchups[i];

    // Initialize agents
    ratings.getRating(agent1.id);
    ratings.getRating(agent2.id);

    const matchSeed = `${baseSeed}:${i}`;

    const report = await runMatch(game, [agent1, agent2], {
      seed: matchSeed,
      gameConfig: config.gameConfig,
    });

    totalTurns += report.totalTurns;
    totalTimeMs += report.totalTimeMs;

    let winnerId: string | null = null;
    if (!report.results.isDraw) {
      winnerId = [agent1, agent2][report.results.winner!].id;
    }

    const p1Rating = ratings.getRating(agent1.id);
    const p2Rating = ratings.getRating(agent2.id);

    ratings.recordMatch(agent1.id, agent2.id, winnerId);

    const result: MatchResult = {
      match: report,
      player1: agent1.id,
      player2: agent2.id,
      winnerId,
      ratingUpdate: {
        player1Before: p1Rating,
        player1After: ratings.getRating(agent1.id),
        player2Before: p2Rating,
        player2After: ratings.getRating(agent2.id),
      },
    };

    matches.push(result);

    if (config.onMatchComplete) {
      config.onMatchComplete(result);
    }
  }

  return {
    matches,
    ratings,
    leaderboard: ratings.getLeaderboard(),
    stats: {
      totalMatches: matches.length,
      totalTurns,
      totalTimeMs,
    },
  };
}
