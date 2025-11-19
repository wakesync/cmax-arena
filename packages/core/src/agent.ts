/**
 * Agent interface for CMAX Arena
 */

import type { DecideInput, DecideOutput } from "./types.js";

// Agent kind
export type AgentKind = "local" | "remote";

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
