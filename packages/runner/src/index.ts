/**
 * CMAX Match Runner Service
 *
 * Polls Supabase for pending matches and executes them
 * using the cmax-arena framework.
 */

import "dotenv/config";
import { startPolling } from "./queue.js";
import { runMatch } from "./runner.js";
import { getAvailableGames, getAvailableAgents } from "./arena.js";

console.log("=========================================");
console.log("     CMAX Match Runner Service");
console.log("=========================================");
console.log("");
console.log("Available games:", getAvailableGames().join(", "));
console.log("Available agents:", getAvailableAgents().join(", "));
console.log("");
console.log("Starting polling for pending matches...");
console.log("");

// Start the polling loop
startPolling(runMatch);

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down...");
  process.exit(0);
});

// Keep process alive
setInterval(() => {
  // Heartbeat - keep the process running
}, 60000);
