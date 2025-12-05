/**
 * CMAX Arena CLI
 */

import { Command } from "commander";
import {
  runMatch,
  writeMatchLog,
  getDefaultLogPath,
  readMatchLog,
  replayMatch,
  extractMatchMeta,
  VERSION,
} from "@cmax/core";
import { games, listGames, getGame } from "@cmax/games";
import { agents, listAgents, getAgent } from "@cmax/agents";

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
      const agent = getAgent(id);
      if (!agent) {
        console.error(`Unknown agent: ${id}`);
        console.error(`Available agents: ${listAgents().join(", ")}`);
        process.exit(1);
      }
      return agent;
    });

    console.log(`Running ${gameId} match...`);
    console.log(`Agents: ${agentIds.join(" vs ")}`);
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
