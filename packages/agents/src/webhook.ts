/**
 * Webhook Agent
 *
 * Calls external HTTP endpoints to get agent decisions.
 * Implements the CMAX Agent Protocol for webhook-based agents.
 */

import crypto from "crypto";
import type {
  Agent,
  DecideInput,
  DecideOutput,
  WebhookAgentConfig,
  WebhookRequest,
  WebhookResponse,
} from "@cmax/core";

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Convert DecideInput to WebhookRequest format
 */
function formatWebhookRequest(input: DecideInput): WebhookRequest {
  return {
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
    matchId: input.matchId,
    gameId: input.gameId,
    roundNumber: input.meta.turnIndex,
    playerId: input.playerId,
    observation: input.observation,
    legalActions: input.legalActions,
  };
}

/**
 * Parse and validate webhook response
 */
function parseWebhookResponse(
  data: unknown,
  requestId: string,
  legalActions: unknown[]
): { action: unknown; reason?: string } | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const response = data as Record<string, unknown>;

  // Validate request ID matches
  if (response.requestId !== requestId) {
    console.warn(`Webhook response requestId mismatch: expected ${requestId}, got ${response.requestId}`);
  }

  // Extract action
  const action = response.action;
  if (action === undefined || action === null) {
    return null;
  }

  // Validate action is legal
  const isLegal = legalActions.some((legal) => {
    if (typeof legal === "string" && typeof action === "string") {
      return legal.toLowerCase() === action.toLowerCase();
    }
    return JSON.stringify(legal) === JSON.stringify(action);
  });

  if (!isLegal) {
    console.warn(`Webhook returned illegal action: ${JSON.stringify(action)}`);
    return null;
  }

  return {
    action,
    reason: typeof response.reasoning === "string" ? response.reasoning : undefined,
  };
}

/**
 * Create a webhook-based agent
 */
export function createWebhookAgent(config: WebhookAgentConfig & { id?: string; displayName?: string }): Agent {
  const {
    endpoint,
    authHeader,
    authToken,
    timeoutMs = 10000,
    retries = 1,
    webhookSecret,
    id,
    displayName,
  } = config;

  // Extract a simple ID from the endpoint
  const endpointId = new URL(endpoint).hostname.replace(/\./g, "_");
  const agentId = id || `webhook_${endpointId}`;
  const agentDisplayName = displayName || `Webhook (${new URL(endpoint).hostname})`;

  return {
    id: agentId,
    version: "1.0.0",
    displayName: agentDisplayName,
    kind: "webhook",
    config: { endpoint },

    async decide(input: DecideInput): Promise<DecideOutput> {
      const webhookRequest = formatWebhookRequest(input);
      const payload = JSON.stringify(webhookRequest);

      // Build headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-CMAX-Timestamp": webhookRequest.timestamp,
      };

      // Add auth header if configured
      if (authHeader && authToken) {
        headers[authHeader] = authToken;
      }

      // Add signature if secret is configured
      if (webhookSecret) {
        const signature = generateSignature(payload, webhookSecret);
        headers["X-CMAX-Signature"] = `sha256=${signature}`;
      }

      // Attempt request with retries
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          const response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: payload,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const data = (await response.json()) as WebhookResponse;

          // Parse and validate response
          const parsed = parseWebhookResponse(
            data,
            webhookRequest.requestId,
            input.legalActions
          );

          if (parsed) {
            return {
              action: parsed.action,
              reason: parsed.reason || `Webhook response from ${endpoint}`,
            };
          }

          // Invalid response, try again if retries left
          throw new Error("Invalid webhook response format");
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (error instanceof Error && error.name === "AbortError") {
            console.warn(`Webhook timeout (attempt ${attempt + 1}/${retries + 1}): ${endpoint}`);
          } else {
            console.warn(`Webhook error (attempt ${attempt + 1}/${retries + 1}): ${lastError.message}`);
          }

          // Don't retry on client errors (4xx)
          if (lastError.message.includes("HTTP 4")) {
            break;
          }
        }
      }

      // All retries failed, fall back to first legal action
      console.error(`Webhook failed after ${retries + 1} attempts: ${endpoint}`);
      return {
        action: input.legalActions[0],
        reason: `Webhook error: ${lastError?.message || "unknown"}, fell back to first legal action`,
      };
    },
  };
}

/**
 * Health check for a webhook agent
 */
export async function checkWebhookHealth(
  endpoint: string,
  timeoutMs: number = 5000
): Promise<{
  status: "healthy" | "unhealthy" | "timeout" | "error";
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();

  const testRequest: WebhookRequest = {
    requestId: `health_${Date.now()}`,
    timestamp: new Date().toISOString(),
    matchId: "health_check",
    gameId: "rps",
    roundNumber: 0,
    playerId: 0,
    observation: { round: 1, myScore: 0, opponentScore: 0, history: [] },
    legalActions: ["rock", "paper", "scissors"],
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CMAX-Health-Check": "true",
      },
      body: JSON.stringify(testRequest),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;

    if (!response.ok) {
      return {
        status: "unhealthy",
        latencyMs,
        error: `HTTP ${response.status}`,
      };
    }

    return { status: "healthy", latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - start;

    if (error instanceof Error && error.name === "AbortError") {
      return { status: "timeout", latencyMs, error: "Request timed out" };
    }

    return {
      status: "error",
      latencyMs,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
