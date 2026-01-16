/**
 * Agent interface for CMAX Arena
 *
 * Supports multiple agent types:
 * - local: Built-in agents running in the same process
 * - llm: LLM agents via OpenRouter API
 * - webhook: External HTTP endpoints that receive observations and return actions
 * - framework: Adapters for agent frameworks (Eliza, LangChain, etc.)
 */

import type { DecideInput, DecideOutput } from "./types.js";

// Agent kind - what type of agent this is
export type AgentKind = "local" | "llm" | "webhook" | "framework";

// Trust level for community agents
export type TrustLevel = "unverified" | "verified" | "official";

// Health status for remote agents
export type HealthStatus = "healthy" | "unhealthy" | "timeout" | "unknown";

/**
 * Agent interface - implement this to create an agent
 */
export interface Agent {
  // Unique identifier
  readonly id: string;

  // Semver version string
  readonly version: string;

  // Human-readable name
  readonly displayName: string;

  // Whether agent runs locally or remotely
  readonly kind: AgentKind;

  // Optional configuration (used for fingerprinting)
  readonly config?: unknown;

  /**
   * Choose an action given the current observation and legal actions
   *
   * @param input Decision input with observation, legal actions, clock, etc.
   * @returns Decision output with chosen action and optional reason
   */
  decide(input: DecideInput): Promise<DecideOutput>;
}

/**
 * Factory function type for creating agents
 */
export type AgentFactory = (config?: unknown) => Agent;

/**
 * Agent registry for looking up agents by ID
 */
export interface AgentRegistry {
  get(id: string): Agent | undefined;
  register(agent: Agent): void;
  list(): Agent[];
}

/**
 * Create a simple in-memory agent registry
 */
export function createAgentRegistry(): AgentRegistry {
  const agents = new Map<string, Agent>();

  return {
    get(id: string) {
      return agents.get(id);
    },
    register(agent: Agent) {
      agents.set(agent.id, agent);
    },
    list() {
      return Array.from(agents.values());
    },
  };
}
