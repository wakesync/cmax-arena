import { describe, it, expect } from "vitest";
import { rps, type RpsState, type RpsAction } from "../src/rps.js";

describe("RPS Game", () => {
  it("should initialize with correct state", () => {
    const state = rps.reset({ seed: "test", numPlayers: 2 });

    expect(state.round).toBe(1);
    expect(state.totalRounds).toBe(10); // default
    expect(state.scores).toEqual([0, 0]);
    expect(state.history).toEqual([]);
    expect(state.currentMoves).toEqual([null, null]);
    expect(state.phase).toBe("playing");
  });

  it("should respect config rounds", () => {
    const state = rps.reset({
      seed: "test",
      numPlayers: 2,
      config: { rounds: 5, showPreviousMoves: true },
    });

    expect(state.totalRounds).toBe(5);
  });

  it("should return correct legal actions", () => {
    const state = rps.reset({ seed: "test", numPlayers: 2 });
    const actions = rps.legalActions({ state, playerId: 0 });

    expect(actions).toContain("rock");
    expect(actions).toContain("paper");
    expect(actions).toContain("scissors");
    expect(actions).toHaveLength(3);
  });

  it("should track current player correctly", () => {
    let state = rps.reset({ seed: "test", numPlayers: 2 });

    // Player 0 first
    expect(rps.currentPlayer(state)).toBe(0);

    // After player 0 moves
    const result1 = rps.step({
      state,
      playerId: 0,
      action: "rock",
      rng: null as any,
    });
    state = result1.state;
    expect(rps.currentPlayer(state)).toBe(1);

    // After player 1 moves (round complete)
    const result2 = rps.step({
      state,
      playerId: 1,
      action: "paper",
      rng: null as any,
    });
    state = result2.state;
    expect(rps.currentPlayer(state)).toBe(0); // Back to player 0
  });

  it("should resolve rock-paper-scissors correctly", () => {
    const testCases: Array<{
      p0: RpsAction;
      p1: RpsAction;
      winner: 0 | 1 | null;
    }> = [
      { p0: "rock", p1: "scissors", winner: 0 },
      { p0: "paper", p1: "rock", winner: 0 },
      { p0: "scissors", p1: "paper", winner: 0 },
      { p0: "scissors", p1: "rock", winner: 1 },
      { p0: "rock", p1: "paper", winner: 1 },
      { p0: "paper", p1: "scissors", winner: 1 },
      { p0: "rock", p1: "rock", winner: null },
      { p0: "paper", p1: "paper", winner: null },
      { p0: "scissors", p1: "scissors", winner: null },
    ];

    for (const tc of testCases) {
      let state = rps.reset({
        seed: "test",
        numPlayers: 2,
        config: { rounds: 1, showPreviousMoves: false },
      });

      // Player 0 moves
      state = rps.step({
        state,
        playerId: 0,
        action: tc.p0,
        rng: null as any,
      }).state;

      // Player 1 moves
      state = rps.step({
        state,
        playerId: 1,
        action: tc.p1,
        rng: null as any,
      }).state;

      const results = rps.getResults(state);

      if (tc.winner === null) {
        expect(results.isDraw).toBe(true);
      } else {
        expect(results.winner).toBe(tc.winner);
      }
    }
  });

  it("should track scores across rounds", () => {
    let state = rps.reset({
      seed: "test",
      numPlayers: 2,
      config: { rounds: 3, showPreviousMoves: true },
    });

    // Round 1: P0 wins (rock beats scissors)
    state = rps.step({ state, playerId: 0, action: "rock", rng: null as any }).state;
    state = rps.step({ state, playerId: 1, action: "scissors", rng: null as any }).state;
    expect(state.scores).toEqual([1, 0]);

    // Round 2: P1 wins (paper beats rock)
    state = rps.step({ state, playerId: 0, action: "rock", rng: null as any }).state;
    state = rps.step({ state, playerId: 1, action: "paper", rng: null as any }).state;
    expect(state.scores).toEqual([1, 1]);

    // Round 3: Draw
    state = rps.step({ state, playerId: 0, action: "rock", rng: null as any }).state;
    state = rps.step({ state, playerId: 1, action: "rock", rng: null as any }).state;
    expect(state.scores).toEqual([1, 1]);

    expect(rps.isTerminal(state)).toBe(true);
    const results = rps.getResults(state);
    expect(results.isDraw).toBe(true);
  });

  it("should provide history in observation when enabled", () => {
    let state = rps.reset({
      seed: "test",
      numPlayers: 2,
      config: { rounds: 2, showPreviousMoves: true },
    });

    // Complete round 1
    state = rps.step({ state, playerId: 0, action: "rock", rng: null as any }).state;
    state = rps.step({ state, playerId: 1, action: "paper", rng: null as any }).state;

    // Check observation for player 0
    const obs0 = rps.observe({ state, playerId: 0 });
    expect(obs0.history).toHaveLength(1);
    expect(obs0.history![0].myMove).toBe("rock");
    expect(obs0.history![0].opponentMove).toBe("paper");
    expect(obs0.history![0].result).toBe("loss");

    // Check observation for player 1
    const obs1 = rps.observe({ state, playerId: 1 });
    expect(obs1.history![0].myMove).toBe("paper");
    expect(obs1.history![0].opponentMove).toBe("rock");
    expect(obs1.history![0].result).toBe("win");
  });

  it("should hide history when disabled", () => {
    let state = rps.reset({
      seed: "test",
      numPlayers: 2,
      config: { rounds: 2, showPreviousMoves: false },
    });

    // Complete round 1
    state = rps.step({ state, playerId: 0, action: "rock", rng: null as any }).state;
    state = rps.step({ state, playerId: 1, action: "paper", rng: null as any }).state;

    const obs = rps.observe({ state, playerId: 0 });
    expect(obs.history).toBeUndefined();
  });

  it("should emit ROUND_END events", () => {
    let state = rps.reset({
      seed: "test",
      numPlayers: 2,
      config: { rounds: 1, showPreviousMoves: false },
    });

    state = rps.step({ state, playerId: 0, action: "rock", rng: null as any }).state;
    const result = rps.step({ state, playerId: 1, action: "scissors", rng: null as any });

    expect(result.events).toBeDefined();
    expect(result.events).toHaveLength(1);
    expect(result.events![0].type).toBe("ROUND_END");
    expect(result.events![0].data).toEqual({
      round: 1,
      moves: { player0: "rock", player1: "scissors" },
      winner: 0,
    });
  });
});
