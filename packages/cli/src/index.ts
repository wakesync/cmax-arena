/**
 * CMAX Arena CLI
 */

import { Command } from "commander";
import {
  runMatch,
  runLadder,
  writeMatchLog,
  getDefaultLogPath,
  readMatchLog,
  replayMatch,
  extractMatchMeta,
  VERSION,
} from "@cmax/core";
import { games, listGames, getGame } from "@cmax/games";
import { agents, listAgents, getAgent, createOpenRouterAgent } from "@cmax/agents";
import type { Agent } from "@cmax/core";

/**
 * Resolve agent ID, supporting both built-in agents and LLM agents
 * LLM agent format: llm:<model> (e.g., llm:anthropic/claude-3.5-sonnet)
 * Requires OPENROUTER_API_KEY environment variable
 */
function resolveAgent(id: string): Agent | undefined {
  // Check for LLM agent prefix
  if (id.startsWith("llm:")) {
    const model = id.slice(4);
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      console.error("Error: OPENROUTER_API_KEY environment variable required for LLM agents");
      process.exit(1);
    }

    return createOpenRouterAgent({
      apiKey,
      model,
      temperature: 0.2,
    });
  }

  // Built-in agent
  return getAgent(id);
}

const program = new Command();

program
  .name("cmax")
  .description("CMAX Arena - AI Agent Competition Framework")
  .version(VERSION);

// Run subcommand
const runCmd = program.command("run").description("Run matches or ladders");

// Run match
runCmd
  .command("match")
  .description("Run a single match between agents")
  .requiredOption("-g, --game <id>", "Game ID (e.g., rps)")
  .requiredOption("-a, --agents <ids>", "Comma-separated agent IDs (e.g., random,random)")
  .option("-s, --seed <seed>", "Random seed", "default-seed")
  .option("-r, --rounds <n>", "Number of rounds (for RPS)", "10")
  .option("-o, --output <path>", "Output log path")
  .option("--no-log", "Disable log output")
  .action(async (options) => {
    const gameId = options.game;
    const game = getGame(gameId);

    if (!game) {
      console.error(`Unknown game: ${gameId}`);
      console.error(`Available games: ${listGames().join(", ")}`);
      process.exit(1);
    }

    const agentIds = options.agents.split(",").map((s: string) => s.trim());
    const matchAgents = agentIds.map((id: string) => {
      const agent = resolveAgent(id);
      if (!agent) {
        console.error(`Unknown agent: ${id}`);
        console.error(`Available agents: ${listAgents().join(", ")}`);
        console.error(`Or use LLM agents: llm:<model> (e.g., llm:anthropic/claude-3.5-sonnet)`);
        process.exit(1);
      }
      return agent;
    });

    console.log(`Running ${gameId} match...`);
    console.log(`Agents: ${matchAgents.map((a: Agent) => a.displayName).join(" vs ")}`);
    console.log(`Seed: ${options.seed}`);

    const gameConfig: Record<string, unknown> = {};
    if (gameId === "rps") {
      gameConfig.rounds = parseInt(options.rounds, 10);
    }

    try {
      const report = await runMatch(game, matchAgents, {
        seed: options.seed,
        gameConfig,
        onEvent: (event) => {
          if (event.type === "TURN") {
            // Optional: show progress
          }
        },
      });

      // Print results
      console.log("\n--- Results ---");
      console.log(`Match ID: ${report.matchId}`);
      console.log(`Total turns: ${report.totalTurns}`);
      console.log(`Time: ${report.totalTimeMs.toFixed(2)}ms`);
      console.log();

      for (const player of report.results.players) {
        const agent = matchAgents[player.playerId];
        const marker = player.rank === 1 ? "🏆" : "  ";
        console.log(`${marker} ${agent.displayName}: ${player.score} points (rank ${player.rank})`);
      }

      if (report.results.isDraw) {
        console.log("\nResult: Draw!");
      } else {
        const winner = matchAgents[report.results.winner!];
        console.log(`\nWinner: ${winner.displayName}`);
      }

      // Write log
      if (options.log !== false) {
        const logPath = options.output ?? getDefaultLogPath(report.matchId);
        writeMatchLog(report, logPath);
        console.log(`\nLog saved: ${logPath}`);
      }
    } catch (err) {
      console.error("Match failed:", err);
      process.exit(1);
    }
  });

// Run ladder
runCmd
  .command("ladder")
  .description("Run a round-robin ladder between agents")
  .requiredOption("-g, --game <id>", "Game ID (e.g., rps, kuhn_poker)")
  .requiredOption("-a, --agents <ids>", "Comma-separated agent IDs")
  .option("-s, --seed <seed>", "Random seed", "ladder-seed")
  .option("-m, --matches <n>", "Matches per agent pair", "2")
  .option("-r, --rounds <n>", "Number of rounds for RPS", "10")
  .option("-k, --k-factor <n>", "Elo K-factor", "32")
  .action(async (options) => {
    const gameId = options.game;
    const game = getGame(gameId);

    if (!game) {
      console.error(`Unknown game: ${gameId}`);
      console.error(`Available games: ${listGames().join(", ")}`);
      process.exit(1);
    }

    const agentIds = options.agents.split(",").map((s: string) => s.trim());
    if (agentIds.length < 2) {
      console.error("Ladder requires at least 2 agents");
      process.exit(1);
    }

    const ladderAgents = agentIds.map((id: string) => {
      const agent = resolveAgent(id);
      if (!agent) {
        console.error(`Unknown agent: ${id}`);
        console.error(`Available agents: ${listAgents().join(", ")}`);
        console.error(`Or use LLM agents: llm:<model> (e.g., llm:anthropic/claude-3.5-sonnet)`);
        process.exit(1);
      }
      return agent;
    });

    console.log(`Running ${gameId} ladder...`);
    console.log(`Agents: ${ladderAgents.map((a: Agent) => a.displayName).join(", ")}`);
    console.log(`Matches per pair: ${options.matches}`);
    console.log(`Seed: ${options.seed}`);
    console.log();

    const gameConfig: Record<string, unknown> = {};
    if (gameId === "rps") {
      gameConfig.rounds = parseInt(options.rounds, 10);
    }

    let matchCount = 0;
    try {
      const result = await runLadder(game, ladderAgents, {
        seed: options.seed,
        matchesPerPair: parseInt(options.matches, 10),
        gameConfig,
        elo: { kFactor: parseInt(options.kFactor, 10) },
        onMatchComplete: (match) => {
          matchCount++;
          const winner = match.winnerId ?? "Draw";
          console.log(
            `  Match ${matchCount}: ${match.player1} vs ${match.player2} → ${winner}`
          );
        },
      });

      // Print leaderboard
      console.log("\n--- Leaderboard ---");
      console.log();

      let rank = 1;
      for (const player of result.leaderboard) {
        const medal =
          rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "  ";
        const winRate =
          player.matches > 0
            ? ((player.wins / player.matches) * 100).toFixed(1)
            : "0.0";
        console.log(
          `${medal} #${rank} ${player.playerId.padEnd(15)} ${String(player.rating).padStart(4)} Elo  ${player.wins}W/${player.losses}L/${player.draws}D (${winRate}%)`
        );
        rank++;
      }

      console.log();
      console.log("--- Stats ---");
      console.log(`Total matches: ${result.stats.totalMatches}`);
      console.log(`Total turns: ${result.stats.totalTurns}`);
      console.log(`Total time: ${result.stats.totalTimeMs.toFixed(2)}ms`);
    } catch (err) {
      console.error("Ladder failed:", err);
      process.exit(1);
    }
  });

// Replay command
program
  .command("replay")
  .description("Replay and verify a match log")
  .requiredOption("-l, --log <path>", "Path to the match log file")
  .option("--verify", "Verify determinism (default: true)", true)
  .option("--no-verify", "Skip verification")
  .action((options) => {
    const logPath = options.log;

    console.log(`Loading log: ${logPath}`);

    try {
      const events = readMatchLog(logPath);
      const meta = extractMatchMeta(events);

      if (!meta) {
        console.error("Invalid log file: missing MATCH_START event");
        process.exit(1);
      }

      console.log(`Match ID: ${meta.matchId}`);
      console.log(`Game: ${meta.gameId} v${meta.gameVersion}`);
      console.log(`Seed commit: ${meta.seedCommit}`);

      if (meta.seedReveal) {
        console.log(`Seed reveal: ${meta.seedReveal}`);
      }

      if (options.verify) {
        console.log("\nVerifying determinism...");

        const game = getGame(meta.gameId);
        if (!game) {
          console.error(`Unknown game: ${meta.gameId}`);
          console.error("Cannot verify without game definition");
          process.exit(1);
        }

        const result = replayMatch(game, events);

        if (result.success) {
          console.log(`Verified: ${result.turnsVerified}/${result.totalTurns} turns`);
          console.log("Determinism check: PASSED");
        } else {
          console.error("Determinism check: FAILED");
          console.error(`Errors (${result.errors.length}):`);
          for (const error of result.errors) {
            console.error(`  - [${error.type}] ${error.message}`);
          }
          process.exit(1);
        }
      }
    } catch (err) {
      console.error("Replay failed:", err);
      process.exit(1);
    }
  });

// List subcommand
const listCmd = program.command("list").description("List available games or agents");

listCmd
  .command("games")
  .description("List available games")
  .action(() => {
    console.log("Available games:\n");
    for (const id of listGames()) {
      const game = games[id];
      console.log(`  ${id} (v${game.version})`);
      console.log(`    Players: ${typeof game.numPlayers === "number" ? game.numPlayers : `${game.numPlayers.min}-${game.numPlayers.max}`}`);
    }
  });

listCmd
  .command("agents")
  .description("List available agents")
  .action(() => {
    console.log("Available agents:\n");
    for (const id of listAgents()) {
      const agent = agents[id];
      console.log(`  ${id} (v${agent.version})`);
      console.log(`    ${agent.displayName}`);
    }
  });

program.parse();
