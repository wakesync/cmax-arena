/**
 * OpenRouter LLM Agent
 *
 * Uses OpenRouter API to let any LLM play games.
 * Supports Claude, GPT-4, Llama, Mistral, and more.
 */

import type { Agent, DecideInput, DecideOutput } from "@cmax/core";

export interface OpenRouterConfig {
  apiKey: string;
  model: string; // e.g., "anthropic/claude-3.5-sonnet", "openai/gpt-4-turbo"
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const DEFAULT_SYSTEM_PROMPT = `You are an AI agent playing a game. You will receive game observations and must choose from the available legal actions.

IMPORTANT: Respond with ONLY the action name, nothing else. No explanation, no reasoning, just the action.

Example valid responses:
- rock
- paper
- bet
- fold
- check

Do NOT include any other text, punctuation, or formatting.`;

/**
 * Format game observation into a prompt for the LLM
 */
function formatPrompt(input: DecideInput): string {
  const obs = input.observation;
  const actions = input.legalActions;

  let prompt = `Game: ${input.gameId}\n`;
  prompt += `You are Player ${input.playerId}\n\n`;

  prompt += `Current observation:\n`;
  prompt += JSON.stringify(obs, null, 2);
  prompt += `\n\n`;

  prompt += `Legal actions: ${actions.join(", ")}\n\n`;
  prompt += `Choose ONE action from the list above. Respond with ONLY the action name.`;

  return prompt;
}

/**
 * Parse LLM response to extract action
 */
function parseAction(response: string, legalActions: string[]): string | null {
  const cleaned = response.trim().toLowerCase();

  // Direct match
  for (const action of legalActions) {
    if (cleaned === action.toLowerCase()) {
      return action;
    }
  }

  // Partial match (LLM might add punctuation or extra words)
  for (const action of legalActions) {
    if (cleaned.includes(action.toLowerCase())) {
      return action;
    }
  }

  return null;
}

/**
 * Create an OpenRouter-powered LLM agent
 */
export function createOpenRouterAgent(config: OpenRouterConfig): Agent {
  const {
    apiKey,
    model,
    temperature = 0.3,
    maxTokens = 50,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
  } = config;

  // Extract display name from model
  const modelShort = model.split("/").pop() || model;

  return {
    id: `llm_${modelShort.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`,
    version: "1.0.0",
    displayName: `LLM (${modelShort})`,
    kind: "llm",
    config: { model },

    async decide(input: DecideInput): Promise<DecideOutput> {
      const messages: OpenRouterMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: formatPrompt(input) },
      ];

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/wakesync/cmax-arena",
            "X-Title": "CMAX Arena",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
        }

        const data = (await response.json()) as OpenRouterResponse;
        const content = data.choices[0]?.message?.content || "";

        // Parse action from response
        const action = parseAction(content, input.legalActions as string[]);

        if (action) {
          return {
            action,
            reason: `LLM chose: "${content.trim()}"`,
          };
        }

        // Fallback: pick first legal action if parsing fails
        console.warn(`LLM response "${content}" not in legal actions, using fallback`);
        return {
          action: input.legalActions[0],
          reason: `LLM response "${content}" invalid, fell back to first legal action`,
        };
      } catch (error) {
        console.error("OpenRouter API call failed:", error);
        // Fallback on error
        return {
          action: input.legalActions[0],
          reason: `API error, fell back to first legal action`,
        };
      }
    },
  };
}

/**
 * Pre-configured agents for popular models
 */
export function createClaudeAgent(apiKey: string, model = "anthropic/claude-3.5-sonnet"): Agent {
  return createOpenRouterAgent({ apiKey, model, temperature: 0.2 });
}

export function createGPT4Agent(apiKey: string, model = "openai/gpt-4-turbo"): Agent {
  return createOpenRouterAgent({ apiKey, model, temperature: 0.2 });
}

export function createLlamaAgent(apiKey: string, model = "meta-llama/llama-3.1-70b-instruct"): Agent {
  return createOpenRouterAgent({ apiKey, model, temperature: 0.3 });
}

export function createMistralAgent(apiKey: string, model = "mistralai/mistral-large"): Agent {
  return createOpenRouterAgent({ apiKey, model, temperature: 0.3 });
}
