import { describe, it, expect } from "vitest";
import { replayMatch, isValidLogFormat } from "../src/replay.js";
import type { MatchEvent } from "../src/orchestrator.js";
import type { GameDefinition } from "../src/game.js";

// Simple test game for replay testing
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

  observe({ playerId }) {
    return { playerId };
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
    return { state: { moves: newMoves, done } };
  },

  isTerminal(state) {
    return state.done;
  },

  getResults(state) {
    const [m0, m1] = state.moves;
    if (m0 === null || m1 === null) throw new Error("Game not finished");
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

// Golden log for determinism testing
const goldenLog: MatchEvent[] = [
  {
    type: "MATCH_START",
    matchId: "test_match_001",
    startedAt: "2024-01-01T00:00:00.000Z",
    gameId: "test_game",
    gameVersion: "1.0.0",
    agents: [
      { id: "agent1", version: "1.0.0", displayName: "Agent 1", fingerprint: "fp1" },
      { id: "agent2", version: "1.0.0", displayName: "Agent 2", fingerprint: "fp2" },
    ],
    seedCommit: "d63cd08d82aa4eb48e0cc64fb466e909bfc3879664c5caa8d8cdeda73c044190",
    config: {},
  },
  {
    type: "TURN",
    turnIndex: 0,
    playerId: 0,
    observationHash: "3b48fcd60afc8621c2c2fa9b6e426ee0c13dcaa0b16b5f8fb6c65d73355ba5a0",
    action: 2,
    timingMs: 1,
    timedOut: false,
    illegalAction: false,
  },
  {
    type: "TURN",
    turnIndex: 1,
    playerId: 1,
    observationHash: "ca1e83c1d4bb2fbb76c31fa0b9a07b62e55b7a50ac16d2d1e2b8ef5e3f7f8b99",
    action: 1,
    timingMs: 1,
    timedOut: false,
    illegalAction: false,
  },
  {
    type: "MATCH_END",
    seedReveal: "test-seed",
    results: {
      players: [
        { playerId: 0, score: 2, rank: 1 },
        { playerId: 1, score: 1, rank: 2 },
      ],
      winner: 0,
      isDraw: false,
    },
    totalTurns: 2,
    totalTimeMs: 10,
  },
];

describe("Replay", () => {
  it("should validate log format", () => {
    expect(isValidLogFormat(goldenLog)).toBe(true);
    expect(isValidLogFormat([])).toBe(false);
    expect(isValidLogFormat([{ type: "MATCH_START" } as MatchEvent])).toBe(false);
  });

  it("should replay and verify golden log", () => {
    const result = replayMatch(testGame, goldenLog, false); // Skip observation hash check

    expect(result.success).toBe(true);
    expect(result.turnsVerified).toBe(2);
    expect(result.totalTurns).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect seed mismatch", () => {
    const badLog: MatchEvent[] = [
      {
        ...goldenLog[0],
        type: "MATCH_START",
        seedCommit: "wrong_commitment",
      } as MatchEvent,
      goldenLog[1],
      goldenLog[2],
      goldenLog[3],
    ];

    const result = replayMatch(testGame, badLog, false);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.type === "SEED_MISMATCH")).toBe(true);
  });

  it("should detect results mismatch", () => {
    const badLog: MatchEvent[] = [
      goldenLog[0],
      goldenLog[1],
      goldenLog[2],
      {
        type: "MATCH_END",
        seedReveal: "test-seed",
        results: {
          players: [
            { playerId: 0, score: 999, rank: 1 }, // Wrong score
            { playerId: 1, score: 1, rank: 2 },
          ],
          winner: 0,
          isDraw: false,
        },
        totalTurns: 2,
        totalTimeMs: 10,
      },
    ];

    const result = replayMatch(testGame, badLog, false);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.type === "RESULTS_MISMATCH")).toBe(true);
  });

  it("should detect missing events", () => {
    const result1 = replayMatch(testGame, [], false);
    expect(result1.success).toBe(false);
    expect(result1.errors.some((e) => e.type === "MISSING_EVENT")).toBe(true);

    const result2 = replayMatch(testGame, [goldenLog[0]], false);
    expect(result2.success).toBe(false);
    expect(result2.errors.some((e) => e.type === "MISSING_EVENT")).toBe(true);
  });
});
