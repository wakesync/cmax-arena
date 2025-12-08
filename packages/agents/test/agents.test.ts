import { describe, it, expect } from "vitest";
import { randomAgent, rpsCounterAgent, getAgent, listAgents } from "../src/index.js";
import type { DecideInput } from "@cmax/core";

const mockDecideInput: DecideInput = {
  matchId: "test_match",
  gameId: "rps",
  gameVersion: "1.0.0",
  playerId: 0,
  observation: {},
  legalActions: ["rock", "paper", "scissors"],
  clock: { turnTimeoutMs: 5000 },
  meta: { turnIndex: 0 },
};

describe("Random Agent", () => {
  it("should have correct metadata", () => {
    expect(randomAgent.id).toBe("random");
    expect(randomAgent.version).toBe("1.0.0");
    expect(randomAgent.kind).toBe("local");
  });

  it("should return a legal action", async () => {
    const result = await randomAgent.decide(mockDecideInput);

    expect(mockDecideInput.legalActions).toContain(result.action);
  });

  it("should be deterministic with same context", async () => {
    const input1 = { ...mockDecideInput, matchId: "same_match", meta: { turnIndex: 5 } };
    const input2 = { ...mockDecideInput, matchId: "same_match", meta: { turnIndex: 5 } };

    const result1 = await randomAgent.decide(input1);
    const result2 = await randomAgent.decide(input2);

    expect(result1.action).toBe(result2.action);
  });
});

describe("RPS Counter Agent", () => {
  it("should have correct metadata", () => {
    expect(rpsCounterAgent.id).toBe("rps_counter");
    expect(rpsCounterAgent.version).toBe("1.0.0");
    expect(rpsCounterAgent.kind).toBe("local");
  });

  it("should default to rock with no history", async () => {
    const input = {
      ...mockDecideInput,
      observation: { history: [] },
    };

    const result = await rpsCounterAgent.decide(input);
    expect(result.action).toBe("rock");
  });

  it("should counter most common opponent move", async () => {
    const input = {
      ...mockDecideInput,
      observation: {
        history: [
          { myMove: "rock", opponentMove: "rock", result: "draw" },
          { myMove: "rock", opponentMove: "rock", result: "draw" },
          { myMove: "paper", opponentMove: "scissors", result: "loss" },
        ],
      },
    };

    const result = await rpsCounterAgent.decide(input);
    // Opponent plays rock most (2x), so counter with paper
    expect(result.action).toBe("paper");
  });
});

describe("Agent Registry", () => {
  it("should list all agents", () => {
    const agentList = listAgents();

    expect(agentList).toContain("random");
    expect(agentList).toContain("rps_counter");
  });

  it("should get agent by id", () => {
    expect(getAgent("random")).toBe(randomAgent);
    expect(getAgent("rps_counter")).toBe(rpsCounterAgent);
    expect(getAgent("nonexistent")).toBeUndefined();
  });
});
