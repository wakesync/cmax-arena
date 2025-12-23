/**
 * Example: Running a Kuhn Poker match
 *
 * Run with: npx tsx examples/run-kuhn.ts
 */

import { runMatch } from "@cmax/core";
import { kuhnPoker } from "@cmax/games";
import { randomAgent, kuhnRuleAgent } from "@cmax/agents";

async function main() {
  console.log("Running Kuhn Poker match: Random vs Rule Agent\n");

  const report = await runMatch(kuhnPoker, [randomAgent, kuhnRuleAgent], {
    seed: "example-kuhn-match",
    onEvent: (event) => {
      if (event.type === "TURN") {
        const turn = event.data;
        console.log(
          `  Turn ${turn.turnIndex}: Player ${turn.playerId} ${turn.action}s`
        );
      }
    },
  });

  console.log("\n--- Results ---");
  console.log(`Match ID: ${report.matchId}`);
  console.log(`Total turns: ${report.totalTurns}`);
  console.log(`Time: ${report.totalTimeMs.toFixed(2)}ms\n`);

  for (const player of report.results.players) {
    const agent = [randomAgent, kuhnRuleAgent][player.playerId];
    const stats = player.stats as { card?: string };
    console.log(
      `${agent.displayName}: ${player.score > 0 ? "+" : ""}${player.score} chips (${stats.card || "?"})`
    );
  }

  const winner = [randomAgent, kuhnRuleAgent][report.results.winner!];
  console.log(`\nWinner: ${winner.displayName}`);
}

main().catch(console.error);
