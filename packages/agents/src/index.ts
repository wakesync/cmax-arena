// @cmax/agents - Reference agents

export const AGENTS_VERSION = "0.1.0";

// Random agent
export { randomAgent, createRandomAgent } from "./random.js";
export type { RandomAgentConfig } from "./random.js";

// RPS counter agent
export { rpsCounterAgent } from "./rps-counter.js";

// Agent registry
import { randomAgent } from "./random.js";
import { rpsCounterAgent } from "./rps-counter.js";
import type { Agent } from "@cmax/core";

export const agents: Record<string, Agent> = {
  random: randomAgent,
  rps_counter: rpsCounterAgent,
};

export function getAgent(id: string): Agent | undefined {
  return agents[id];
}

export function listAgents(): string[] {
  return Object.keys(agents);
}
