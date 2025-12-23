/**
 * Example: Running a Rock-Paper-Scissors match
 *
 * Run with: npx tsx examples/run-rps.ts
 */

import { runMatch, writeMatchLog, getDefaultLogPath } from "@cmax/core";
import { rps } from "@cmax/games";
import { randomAgent, rpsCounterAgent } from "@cmax/agents";

async function main() {
  console.log("Running RPS match: Random vs Counter Agent\n");

  const report = await runMatch(rps, [randomAgent, rpsCounterAgent], {
    seed: "example-rps-match",
    gameConfig: { rounds: 10, showPreviousMoves: true },
    onEvent: (event) => {
      if (event.type === "TURN") {
        const turn = event.data;
        console.log(
          `  Turn ${turn.turnIndex}: Player ${turn.playerId} plays ${turn.action}`
        );
      }
    },
  });

  console.log("\n--- Results ---");
  console.log(`Match ID: ${report.matchId}`);
  console.log(`Total turns: ${report.totalTurns}`);
  console.log(`Time: ${report.totalTimeMs.toFixed(2)}ms\n`);

  for (const player of report.results.players) {
    const agent = [randomAgent, rpsCounterAgent][player.playerId];
    console.log(`${agent.displayName}: ${player.score} points (rank ${player.rank})`);
  }

  if (report.results.isDraw) {
    console.log("\nResult: Draw!");
  } else {
    const winner = [randomAgent, rpsCounterAgent][report.results.winner!];
    console.log(`\nWinner: ${winner.displayName}`);
  }

  // Save the match log
  const logPath = getDefaultLogPath(report.matchId);
  writeMatchLog(report, logPath);
  console.log(`\nLog saved: ${logPath}`);
}

main().catch(console.error);
