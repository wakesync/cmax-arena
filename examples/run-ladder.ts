/**
 * Example: Running a ladder tournament
 *
 * Run with: npx tsx examples/run-ladder.ts
 */

import { runLadder } from "@cmax/core";
import { rps } from "@cmax/games";
import { randomAgent, rpsCounterAgent, createRandomAgent } from "@cmax/agents";

async function main() {
  // Create multiple agents with different seeds
  const agents = [
    randomAgent,
    rpsCounterAgent,
    { ...createRandomAgent({ seed: "alice" }), id: "random_alice", displayName: "Random Alice" },
    { ...createRandomAgent({ seed: "bob" }), id: "random_bob", displayName: "Random Bob" },
  ];

  console.log("Running RPS Ladder Tournament\n");
  console.log(`Agents: ${agents.map((a) => a.id).join(", ")}`);
  console.log(`Matches per pair: 4\n`);

  const result = await runLadder(rps, agents, {
    seed: "example-ladder",
    matchesPerPair: 4,
    gameConfig: { rounds: 5 },
    elo: { kFactor: 32 },
    onMatchComplete: (match) => {
      const winner = match.winnerId ?? "Draw";
      console.log(`  ${match.player1} vs ${match.player2} → ${winner}`);
    },
  });

  console.log("\n--- Leaderboard ---\n");

  let rank = 1;
  for (const player of result.leaderboard) {
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "  ";
    const winRate =
      player.matches > 0
        ? ((player.wins / player.matches) * 100).toFixed(1)
        : "0.0";
    console.log(
      `${medal} #${rank} ${player.playerId.padEnd(15)} ${String(player.rating).padStart(4)} Elo  ` +
        `${player.wins}W/${player.losses}L/${player.draws}D (${winRate}%)`
    );
    rank++;
  }

  console.log("\n--- Stats ---");
  console.log(`Total matches: ${result.stats.totalMatches}`);
  console.log(`Total turns: ${result.stats.totalTurns}`);
  console.log(`Total time: ${result.stats.totalTimeMs.toFixed(2)}ms`);
}

main().catch(console.error);
