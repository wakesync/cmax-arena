/**
 * Table Talk Engine
 *
 * Generates contextual AI banter during matches.
 * Uses a combination of preset reactions and LLM-generated content.
 */

import type {
  AgentPersonality,
  TableTalkEvent,
  TableTalkContext,
  TableTalkType,
  ReactionTrigger,
} from "./types.js";

/**
 * Configuration for the table talk engine
 */
export interface TableTalkConfig {
  /** Minimum milliseconds between talks per agent */
  minInterval: number;
  /** Maximum history to track per agent */
  maxHistory: number;
  /** Whether to use LLM for generation (vs preset only) */
  useLLM: boolean;
  /** LLM endpoint (OpenRouter) */
  llmEndpoint?: string;
  /** LLM API key */
  llmApiKey?: string;
  /** Model to use for talk generation */
  llmModel?: string;
}

const DEFAULT_CONFIG: TableTalkConfig = {
  minInterval: 5000,
  maxHistory: 10,
  useLLM: false,
  llmModel: "openai/gpt-4o-mini",
};

/**
 * Table Talk Engine
 *
 * Manages AI banter generation with rate limiting,
 * personality-aware responses, and optional LLM generation.
 */
export class TableTalkEngine {
  private config: TableTalkConfig;
  private talkHistory: Map<string, TableTalkEvent[]> = new Map();
  private lastTalkTime: Map<string, number> = new Map();

  constructor(config: Partial<TableTalkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate table talk for an agent
   *
   * Returns null if rate limited or personality decides to stay silent.
   */
  async generateTalk(
    agentId: string,
    personality: AgentPersonality,
    context: TableTalkContext
  ): Promise<TableTalkEvent | null> {
    // Rate limiting
    const lastTime = this.lastTalkTime.get(agentId) || 0;
    if (Date.now() - lastTime < this.config.minInterval) {
      return null;
    }

    // Probability based on personality verbosity
    const talkProbability = personality.traits.verbosity / 10;
    if (Math.random() > talkProbability) {
      return null;
    }

    // Check if this context warrants a response
    if (!this.shouldRespond(context, personality)) {
      return null;
    }

    // Generate the message
    const message = await this.generateMessage(personality, context);
    if (!message) return null;

    // Create event
    const event: TableTalkEvent = {
      type: this.getTalkType(context),
      agentId,
      message,
      timestamp: Date.now(),
      context: context.trigger,
    };

    // Track history
    const history = this.talkHistory.get(agentId) || [];
    history.push(event);
    if (history.length > this.config.maxHistory) history.shift();
    this.talkHistory.set(agentId, history);
    this.lastTalkTime.set(agentId, Date.now());

    return event;
  }

  /**
   * Generate a reaction to another agent's action
   */
  async generateReaction(
    agentId: string,
    personality: AgentPersonality,
    context: TableTalkContext,
    actingAgentId: string
  ): Promise<TableTalkEvent | null> {
    // Rate limiting
    const lastTime = this.lastTalkTime.get(agentId) || 0;
    if (Date.now() - lastTime < this.config.minInterval) {
      return null;
    }

    // Only react to high drama
    if (context.dramaSeverity < 2) {
      return null;
    }

    // Check for rivalry
    const rivalry = personality.rivalries?.find((r) => r.agentId === actingAgentId);
    if (rivalry && rivalry.special_taunts.length > 0) {
      // Use a special taunt for rivals
      const taunt =
        rivalry.special_taunts[
          Math.floor(Math.random() * rivalry.special_taunts.length)
        ];

      const event: TableTalkEvent = {
        type: "taunt",
        agentId,
        message: taunt,
        timestamp: Date.now(),
        context: `rivalry_${actingAgentId}`,
      };

      this.lastTalkTime.set(agentId, Date.now());
      return event;
    }

    // Generate regular reaction
    return this.generateTalk(agentId, personality, {
      ...context,
      opponentId: actingAgentId,
    });
  }

  /**
   * Determine if agent should respond based on context and personality
   */
  private shouldRespond(
    context: TableTalkContext,
    personality: AgentPersonality
  ): boolean {
    // High drama = always respond
    if (context.dramaSeverity >= 3) return true;

    // Style-based responses
    switch (personality.style) {
      case "aggressive":
        // Aggressive personalities respond more
        return context.dramaSeverity >= 2 || Math.random() < 0.4;

      case "philosopher":
        // Philosophers respond to interesting situations
        return context.isInteresting || context.dramaSeverity >= 2;

      case "stoic":
        // Stoic personalities rarely respond
        return context.dramaSeverity >= 3;

      case "chaotic":
        // Chaotic personalities respond randomly
        return Math.random() < 0.5;

      case "calculated":
      default:
        // Balanced response rate
        return context.dramaSeverity >= 2 || Math.random() < 0.3;
    }
  }

  /**
   * Generate the actual message content
   */
  private async generateMessage(
    personality: AgentPersonality,
    context: TableTalkContext
  ): Promise<string | null> {
    // First try to use a preset reaction
    const presetReaction = this.getPresetReaction(personality, context);
    if (presetReaction && (!this.config.useLLM || Math.random() > 0.5)) {
      return presetReaction;
    }

    // Use LLM if configured
    if (this.config.useLLM && this.config.llmApiKey) {
      try {
        return await this.generateWithLLM(personality, context);
      } catch (error) {
        console.error("Table talk LLM generation failed:", error);
        return presetReaction || null;
      }
    }

    return presetReaction || null;
  }

  /**
   * Get a preset reaction from personality
   */
  private getPresetReaction(
    personality: AgentPersonality,
    context: TableTalkContext
  ): string | null {
    const trigger = context.trigger as ReactionTrigger;
    const reactions = personality.reactions[trigger];

    if (!reactions || reactions.length === 0) {
      // Try to find a related trigger
      const relatedTriggers = this.getRelatedTriggers(trigger);
      for (const related of relatedTriggers) {
        const relatedReactions = personality.reactions[related as ReactionTrigger];
        if (relatedReactions && relatedReactions.length > 0) {
          return relatedReactions[Math.floor(Math.random() * relatedReactions.length)];
        }
      }
      return null;
    }

    return reactions[Math.floor(Math.random() * reactions.length)];
  }

  /**
   * Get related triggers for fallback
   */
  private getRelatedTriggers(trigger: string): string[] {
    const relations: Record<string, string[]> = {
      bluff_success: ["successful_bluff", "win_big"],
      bluff_caught: ["caught_bluffing", "lose_big"],
      bad_beat: ["lose_big"],
      huge_pot: ["all_in_call", "win_big"],
      comeback: ["win_big"],
      cooler: ["bad_beat", "lose_big"],
      hero_call: ["win_big", "successful_bluff"],
      hero_fold: ["all_in_fold"],
    };

    return relations[trigger] || [];
  }

  /**
   * Generate message using LLM
   */
  private async generateWithLLM(
    personality: AgentPersonality,
    context: TableTalkContext
  ): Promise<string | null> {
    const prompt = this.buildLLMPrompt(personality, context);

    const response = await fetch(
      this.config.llmEndpoint || "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.llmApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.llmModel,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 60,
          temperature: 0.9,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const message = data.choices[0]?.message?.content?.trim();

    if (!message || message === "...") return null;
    return message;
  }

  /**
   * Build prompt for LLM generation
   */
  private buildLLMPrompt(
    personality: AgentPersonality,
    context: TableTalkContext
  ): string {
    return `You are ${personality.name}, a poker-playing AI with the following personality:
- Style: ${personality.style}
- Aggression: ${personality.traits.aggression}/10
- Humor: ${personality.traits.humor}/10
- Arrogance: ${personality.traits.arrogance}/10
- Respect for opponents: ${personality.traits.respect}/10

Your signature phrases: ${personality.voice.signature_phrases.join(", ")}
${personality.voice.uses_emojis ? "You use emojis occasionally." : "You never use emojis."}
${personality.voice.uses_slang ? "You use internet slang." : "You speak formally."}

CURRENT SITUATION:
${context.description}

Pot: $${context.pot.toLocaleString()}
Your chips: $${context.yourChips.toLocaleString()}
${context.opponentName ? `Opponent: ${context.opponentName}` : ""}
${context.lastAction ? `Last action: ${context.lastAction}` : ""}
${context.street ? `Street: ${context.street}` : ""}

Generate a SHORT poker table talk message (max 15 words). Stay in character.
${context.trigger === "long_tank" ? "You are waiting for your opponent to act." : ""}
${context.trigger === "win_big" ? "You just won a big pot!" : ""}
${context.trigger === "lose_big" ? "You just lost a big pot." : ""}
${context.trigger === "bad_beat" ? "You just got a bad beat!" : ""}

Respond with just the message, or "..." if you choose to stay silent.`;
  }

  /**
   * Determine the type of talk based on context
   */
  private getTalkType(context: TableTalkContext): TableTalkType {
    if (context.trigger === "long_tank") return "thinking";
    if (
      context.trigger.includes("bluff") ||
      context.trigger.includes("mistake") ||
      context.trigger === "opponent_mistake"
    ) {
      return "taunt";
    }
    if (context.dramaSeverity >= 2) return "reaction";
    return "chat";
  }

  /**
   * Get talk history for an agent
   */
  getHistory(agentId: string): TableTalkEvent[] {
    return this.talkHistory.get(agentId) || [];
  }

  /**
   * Clear talk history for an agent
   */
  clearHistory(agentId: string): void {
    this.talkHistory.delete(agentId);
    this.lastTalkTime.delete(agentId);
  }

  /**
   * Clear all history
   */
  clearAllHistory(): void {
    this.talkHistory.clear();
    this.lastTalkTime.clear();
  }
}

/**
 * Build a talk context from game state
 */
export function buildTalkContext(
  trigger: string,
  description: string,
  gameState: { pot: number; yourChips: number; street?: string },
  dramaSeverity: number = 1,
  options: Partial<TableTalkContext> = {}
): TableTalkContext {
  return {
    trigger,
    description,
    pot: gameState.pot,
    yourChips: gameState.yourChips,
    street: gameState.street,
    dramaSeverity,
    ...options,
  };
}
