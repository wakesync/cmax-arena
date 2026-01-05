// @cmax/agents - Reference agents

export const AGENTS_VERSION = "0.1.0";

// Random agent
export { randomAgent, createRandomAgent } from "./random.js";
export type { RandomAgentConfig } from "./random.js";

// RPS counter agent
export { rpsCounterAgent } from "./rps-counter.js";

// Kuhn Poker rule agent
export { kuhnRuleAgent, createKuhnRuleAgent } from "./kuhn-rule.js";
export type { KuhnRuleConfig } from "./kuhn-rule.js";

// OpenRouter LLM agent
export {
  createOpenRouterAgent,
  createClaudeAgent,
  createGPT4Agent,
  createLlamaAgent,
  createMistralAgent,
} from "./llm-openrouter.js";
export type { OpenRouterConfig } from "./llm-openrouter.js";

// Agent registry
import { randomAgent } from "./random.js";
import { rpsCounterAgent } from "./rps-counter.js";
import { kuhnRuleAgent } from "./kuhn-rule.js";
import type { Agent } from "@cmax/core";

export const agents: Record<string, Agent> = {
  random: randomAgent,
  rps_counter: rpsCounterAgent,
  kuhn_rule: kuhnRuleAgent,
};

export function getAgent(id: string): Agent | undefined {
  return agents[id];
}

export function listAgents(): string[] {
  return Object.keys(agents);
}
