/**
 * Example: Running matches with LLM agents via OpenRouter
 *
 * Set OPENROUTER_API_KEY environment variable before running:
 * OPENROUTER_API_KEY=your_key npx tsx examples/run-llm-match.ts
 */

import { runMatch, runLadder } from "@cmax/core";
import { rps, kuhnPoker } from "@cmax/games";
import {
  randomAgent,
  createOpenRouterAgent,
  createClaudeAgent,
} from "@cmax/agents";

const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  console.error("Error: OPENROUTER_API_KEY environment variable is required");
  console.error("Usage: OPENROUTER_API_KEY=your_key npx tsx examples/run-llm-match.ts");
  process.exit(1);
}

async function runRPSMatch() {
  console.log("=== RPS: Claude vs Random ===\n");

  const claude = createClaudeAgent(API_KEY, "anthropic/claude-3.5-sonnet");

  const report = await runMatch(rps, [claude, randomAgent], {
    seed: "llm-rps-test",
    gameConfig: { rounds: 5, showPreviousMoves: true },
    onEvent: (event) => {
      if (event.type === "TURN") {
        const turn = event.data;
        const agent = turn.playerId === 0 ? "Claude" : "Random";
        console.log(`  ${agent}: ${turn.action}`);
      }
    },
  });

  console.log(`\nResult: ${report.results.isDraw ? "Draw" : `Player ${report.results.winner} wins`}`);
  console.log(`Scores: Claude ${report.results.players[0].score}, Random ${report.results.players[1].score}`);
  console.log(`Time: ${report.totalTimeMs.toFixed(0)}ms`);
}

async function runKuhnMatch() {
  console.log("\n=== Kuhn Poker: Claude vs Random ===\n");

  const claude = createClaudeAgent(API_KEY, "anthropic/claude-3.5-sonnet");

  const report = await runMatch(kuhnPoker, [claude, randomAgent], {
    seed: "llm-kuhn-test",
    onEvent: (event) => {
      if (event.type === "TURN") {
        const turn = event.data;
        const agent = turn.playerId === 0 ? "Claude" : "Random";
        console.log(`  ${agent}: ${turn.action}`);
      }
    },
  });

  const winner = report.results.winner === 0 ? "Claude" : "Random";
  console.log(`\nWinner: ${winner}`);
  console.log(`Scores: Claude ${report.results.players[0].score}, Random ${report.results.players[1].score}`);
  console.log(`Time: ${report.totalTimeMs.toFixed(0)}ms`);
}

async function runModelComparison() {
  console.log("\n=== Model Comparison Ladder (RPS) ===\n");

  // Create agents for different models
  const models = [
    { name: "claude-3.5-sonnet", model: "anthropic/claude-3.5-sonnet" },
    { name: "gpt-4-turbo", model: "openai/gpt-4-turbo" },
    { name: "llama-3.1-70b", model: "meta-llama/llama-3.1-70b-instruct" },
  ];

  const agents = models.map(({ name, model }) =>
    createOpenRouterAgent({
      apiKey: API_KEY,
      model,
      temperature: 0.2,
    })
  );

  // Also include random agent as baseline
  agents.push(randomAgent);

  console.log("Agents:", agents.map((a) => a.displayName).join(", "));
  console.log("Running 2 matches per pair...\n");

  const result = await runLadder(rps, agents, {
    seed: "model-comparison",
    matchesPerPair: 2,
    gameConfig: { rounds: 3 },
    onMatchComplete: (match) => {
      const winner = match.winnerId ?? "Draw";
      console.log(`  ${match.player1} vs ${match.player2} → ${winner}`);
    },
  });

  console.log("\n--- Leaderboard ---\n");
  let rank = 1;
  for (const player of result.leaderboard) {
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "  ";
    console.log(
      `${medal} #${rank} ${player.playerId.padEnd(25)} ${String(player.rating).padStart(4)} Elo  ${player.wins}W/${player.losses}L/${player.draws}D`
    );
    rank++;
  }
}

async function main() {
  try {
    await runRPSMatch();
    await runKuhnMatch();
    // Uncomment to run full model comparison (uses more API calls):
    // await runModelComparison();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
