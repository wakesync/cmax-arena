import { describe, it, expect } from "vitest";
import { runMatch, type MatchReport } from "../src/orchestrator.js";
import type { GameDefinition, Agent, DecideInput, DecideOutput } from "../src/index.js";

// Simple test game: each player picks a number, highest wins
interface TestState {
  moves: [number | null, number | null];
  done: boolean;
}

const testGame: GameDefinition<TestState, number> = {
  id: "test_game",
  version: "1.0.0",
  numPlayers: 2,

  reset() {
    return { moves: [null, null], done: false };
  },

  observe({ state, playerId }) {
    return { playerId, myMove: state.moves[playerId] };
  },

  legalActions() {
    return [1, 2, 3];
  },

  currentPlayer(state) {
    if (state.done) return null;
    if (state.moves[0] === null) return 0;
    if (state.moves[1] === null) return 1;
    return null;
  },

  step({ state, playerId, action }) {
    const newMoves: [number | null, number | null] = [state.moves[0], state.moves[1]];
    newMoves[playerId] = action;

    const done = newMoves[0] !== null && newMoves[1] !== null;

    return {
      state: { moves: newMoves, done },
    };
  },

  isTerminal(state) {
    return state.done;
  },

  getResults(state) {
    const [m0, m1] = state.moves;
    if (m0 === null || m1 === null) {
      throw new Error("Game not finished");
    }

    let winner: 0 | 1 | null = null;
    if (m0 > m1) winner = 0;
    else if (m1 > m0) winner = 1;

    return {
      players: [
        { playerId: 0, score: m0, rank: m0 >= m1 ? 1 : 2 },
        { playerId: 1, score: m1, rank: m1 >= m0 ? 1 : 2 },
      ],
      winner,
      isDraw: winner === null,
    };
  },
};

// Agent that always picks a specific action
function createFixedAgent(id: string, action: number): Agent {
  return {
    id,
    version: "1.0.0",
    displayName: `Fixed ${action}`,
    kind: "local",
    async decide(): Promise<DecideOutput> {
      return { action };
    },
  };
}

// Agent that times out
function createSlowAgent(id: string, delayMs: number): Agent {
  return {
    id,
    version: "1.0.0",
    displayName: "Slow Agent",
    kind: "local",
    async decide(input: DecideInput): Promise<DecideOutput> {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return { action: input.legalActions[0] };
    },
  };
}

// Agent that returns illegal action
function createIllegalAgent(id: string): Agent {
  return {
    id,
    version: "1.0.0",
    displayName: "Illegal Agent",
    kind: "local",
    async decide(): Promise<DecideOutput> {
      return { action: 999 }; // Not in legalActions
    },
  };
}

describe("Orchestrator", () => {
  it("should run a basic match", async () => {
    const agent1 = createFixedAgent("agent1", 3);
    const agent2 = createFixedAgent("agent2", 1);

    const report = await runMatch(testGame, [agent1, agent2], {
      seed: "test-seed",
    });

    expect(report.results.winner).toBe(0);
    expect(report.results.players[0].score).toBe(3);
    expect(report.results.players[1].score).toBe(1);
    expect(report.totalTurns).toBe(2);
  });

  it("should produce deterministic results", async () => {
    const agent1 = createFixedAgent("agent1", 2);
    const agent2 = createFixedAgent("agent2", 2);

    const report1 = await runMatch(testGame, [agent1, agent2], {
      seed: "determinism-test",
    });

    const report2 = await runMatch(testGame, [agent1, agent2], {
      seed: "determinism-test",
    });

    expect(report1.results).toEqual(report2.results);
    expect(report1.totalTurns).toEqual(report2.totalTurns);
  });

  it("should handle draw", async () => {
    const agent1 = createFixedAgent("agent1", 2);
    const agent2 = createFixedAgent("agent2", 2);

    const report = await runMatch(testGame, [agent1, agent2], {
      seed: "draw-test",
    });

    expect(report.results.isDraw).toBe(true);
    expect(report.results.winner).toBe(null);
  });

  it("should handle timeout with fallback", async () => {
    const fastAgent = createFixedAgent("fast", 3);
    const slowAgent = createSlowAgent("slow", 10000); // 10 seconds

    const report = await runMatch(testGame, [fastAgent, slowAgent], {
      seed: "timeout-test",
      turnTimeoutMs: 100, // 100ms timeout
    });

    // Should complete with timeout
    expect(report.totalTurns).toBe(2);

    // Find the slow agent's turn
    const slowTurn = report.events.find(
      (e) => e.type === "TURN" && e.playerId === 1
    );
    expect(slowTurn).toBeDefined();
    if (slowTurn?.type === "TURN") {
      expect(slowTurn.timedOut).toBe(true);
    }
  });

  it("should handle illegal action with fallback", async () => {
    const goodAgent = createFixedAgent("good", 2);
    const badAgent = createIllegalAgent("bad");

    const report = await runMatch(testGame, [goodAgent, badAgent], {
      seed: "illegal-test",
    });

    // Should complete with fallback
    expect(report.totalTurns).toBe(2);

    // Find the illegal agent's turn
    const badTurn = report.events.find(
      (e) => e.type === "TURN" && e.playerId === 1
    );
    expect(badTurn).toBeDefined();
    if (badTurn?.type === "TURN") {
      expect(badTurn.illegalAction).toBe(true);
      expect(badTurn.originalAction).toBe(999);
      expect(badTurn.action).toBe(1); // Fallback to first legal action
    }
  });

  it("should generate proper events", async () => {
    const agent1 = createFixedAgent("agent1", 1);
    const agent2 = createFixedAgent("agent2", 2);

    const report = await runMatch(testGame, [agent1, agent2], {
      seed: "events-test",
    });

    // Check MATCH_START
    const startEvent = report.events.find((e) => e.type === "MATCH_START");
    expect(startEvent).toBeDefined();
    if (startEvent?.type === "MATCH_START") {
      expect(startEvent.gameId).toBe("test_game");
      expect(startEvent.agents).toHaveLength(2);
      expect(startEvent.seedCommit).toBeDefined();
    }

    // Check TURN events
    const turnEvents = report.events.filter((e) => e.type === "TURN");
    expect(turnEvents).toHaveLength(2);

    // Check MATCH_END
    const endEvent = report.events.find((e) => e.type === "MATCH_END");
    expect(endEvent).toBeDefined();
    if (endEvent?.type === "MATCH_END") {
      expect(endEvent.seedReveal).toBe("events-test");
      expect(endEvent.results).toBeDefined();
    }
  });
});
