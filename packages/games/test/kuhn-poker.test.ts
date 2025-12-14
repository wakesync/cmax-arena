import { describe, it, expect } from "vitest";
import { kuhnPoker, type KuhnState, type KuhnAction } from "../src/kuhn-poker.js";

describe("Kuhn Poker", () => {
  it("should initialize with correct state", () => {
    const state = kuhnPoker.reset({ seed: "test", numPlayers: 2 });

    expect(state.pot).toBe(2); // Both players ante 1
    expect(state.bets).toEqual([1, 1]);
    expect(state.phase).toBe("p0_action");
    expect(state.winner).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.cards).toHaveLength(2);
    // Cards should be valid Kuhn cards (1, 2, or 3)
    expect([1, 2, 3]).toContain(state.cards[0]);
    expect([1, 2, 3]).toContain(state.cards[1]);
    // Cards should be different
    expect(state.cards[0]).not.toBe(state.cards[1]);
  });

  it("should deal different cards with different seeds", () => {
    const state1 = kuhnPoker.reset({ seed: "seed1", numPlayers: 2 });
    const state2 = kuhnPoker.reset({ seed: "seed2", numPlayers: 2 });

    // Very unlikely to be the same
    expect(
      state1.cards[0] !== state2.cards[0] || state1.cards[1] !== state2.cards[1]
    ).toBe(true);
  });

  it("should be deterministic with same seed", () => {
    const state1 = kuhnPoker.reset({ seed: "test", numPlayers: 2 });
    const state2 = kuhnPoker.reset({ seed: "test", numPlayers: 2 });

    expect(state1.cards).toEqual(state2.cards);
  });

  it("should throw for non-2-player games", () => {
    expect(() => kuhnPoker.reset({ seed: "test", numPlayers: 3 })).toThrow(
      "Kuhn Poker requires exactly 2 players"
    );
  });

  it("should return correct legal actions for p0_action phase", () => {
    const state = kuhnPoker.reset({ seed: "test", numPlayers: 2 });
    const actions = kuhnPoker.legalActions({ state, playerId: 0 });

    expect(actions).toContain("check");
    expect(actions).toContain("bet");
    expect(actions).toHaveLength(2);
  });

  it("should track current player correctly", () => {
    let state = kuhnPoker.reset({ seed: "test", numPlayers: 2 });

    // Player 0 first
    expect(kuhnPoker.currentPlayer(state)).toBe(0);

    // After player 0 checks
    state = kuhnPoker.step({ state, playerId: 0, action: "check", rng: null as any }).state;
    expect(kuhnPoker.currentPlayer(state)).toBe(1);
    expect(state.phase).toBe("p1_after_check");
  });

  describe("check-check path", () => {
    it("should go to showdown", () => {
      let state = kuhnPoker.reset({ seed: "test", numPlayers: 2 });

      state = kuhnPoker.step({ state, playerId: 0, action: "check", rng: null as any }).state;
      state = kuhnPoker.step({ state, playerId: 1, action: "check", rng: null as any }).state;

      expect(kuhnPoker.isTerminal(state)).toBe(true);
      expect(state.phase).toBe("showdown");
      expect(state.winner).not.toBeNull();
      expect(state.pot).toBe(2); // No additional bets
    });

    it("should award pot to higher card holder", () => {
      // Find a seed where we know the cards
      let state = kuhnPoker.reset({ seed: "test-higher-wins", numPlayers: 2 });

      state = kuhnPoker.step({ state, playerId: 0, action: "check", rng: null as any }).state;
      state = kuhnPoker.step({ state, playerId: 1, action: "check", rng: null as any }).state;

      const results = kuhnPoker.getResults(state);
      const highCardPlayer = state.cards[0] > state.cards[1] ? 0 : 1;

      expect(state.winner).toBe(highCardPlayer);
      expect(results.winner).toBe(highCardPlayer);
    });
  });

  describe("check-bet-fold path", () => {
    it("should let bettor win when opponent folds", () => {
      let state = kuhnPoker.reset({ seed: "test", numPlayers: 2 });

      state = kuhnPoker.step({ state, playerId: 0, action: "check", rng: null as any }).state;
      expect(state.pot).toBe(2);

      state = kuhnPoker.step({ state, playerId: 1, action: "bet", rng: null as any }).state;
      expect(state.pot).toBe(3);
      expect(state.phase).toBe("p0_after_bet");

      state = kuhnPoker.step({ state, playerId: 0, action: "fold", rng: null as any }).state;
      expect(kuhnPoker.isTerminal(state)).toBe(true);
      expect(state.phase).toBe("folded");
      expect(state.winner).toBe(1); // Player 1 wins by fold
    });
  });

  describe("check-bet-call path", () => {
    it("should go to showdown after call", () => {
      let state = kuhnPoker.reset({ seed: "test", numPlayers: 2 });

      state = kuhnPoker.step({ state, playerId: 0, action: "check", rng: null as any }).state;
      state = kuhnPoker.step({ state, playerId: 1, action: "bet", rng: null as any }).state;
      state = kuhnPoker.step({ state, playerId: 0, action: "call", rng: null as any }).state;

      expect(kuhnPoker.isTerminal(state)).toBe(true);
      expect(state.phase).toBe("showdown");
      expect(state.pot).toBe(4); // 1+1 antes + 1+1 bets
      expect(state.bets).toEqual([2, 2]);
    });
  });

  describe("bet-fold path", () => {
    it("should let p0 win when p1 folds", () => {
      let state = kuhnPoker.reset({ seed: "test", numPlayers: 2 });

      state = kuhnPoker.step({ state, playerId: 0, action: "bet", rng: null as any }).state;
      expect(state.pot).toBe(3);
      expect(state.bets).toEqual([2, 1]);

      state = kuhnPoker.step({ state, playerId: 1, action: "fold", rng: null as any }).state;
      expect(kuhnPoker.isTerminal(state)).toBe(true);
      expect(state.winner).toBe(0);
    });
  });

  describe("bet-call path", () => {
    it("should go to showdown", () => {
      let state = kuhnPoker.reset({ seed: "test", numPlayers: 2 });

      state = kuhnPoker.step({ state, playerId: 0, action: "bet", rng: null as any }).state;
      state = kuhnPoker.step({ state, playerId: 1, action: "call", rng: null as any }).state;

      expect(kuhnPoker.isTerminal(state)).toBe(true);
      expect(state.phase).toBe("showdown");
      expect(state.pot).toBe(4);
      expect(state.bets).toEqual([2, 2]);
    });
  });

  describe("observations", () => {
    it("should show own card but not opponent card", () => {
      const state = kuhnPoker.reset({ seed: "test", numPlayers: 2 });

      const obs0 = kuhnPoker.observe({ state, playerId: 0 });
      const obs1 = kuhnPoker.observe({ state, playerId: 1 });

      expect(obs0.myCard).toBe(state.cards[0]);
      expect(obs1.myCard).toBe(state.cards[1]);
      expect(obs0.myCard).not.toBe(obs1.myCard);
    });

    it("should show correct pot and bet amounts", () => {
      let state = kuhnPoker.reset({ seed: "test", numPlayers: 2 });

      state = kuhnPoker.step({ state, playerId: 0, action: "bet", rng: null as any }).state;

      const obs0 = kuhnPoker.observe({ state, playerId: 0 });
      const obs1 = kuhnPoker.observe({ state, playerId: 1 });

      expect(obs0.pot).toBe(3);
      expect(obs0.myBet).toBe(2);
      expect(obs0.opponentBet).toBe(1);

      expect(obs1.pot).toBe(3);
      expect(obs1.myBet).toBe(1);
      expect(obs1.opponentBet).toBe(2);
    });

    it("should show correct available actions", () => {
      let state = kuhnPoker.reset({ seed: "test", numPlayers: 2 });

      const obs0 = kuhnPoker.observe({ state, playerId: 0 });
      expect(obs0.canCheck).toBe(true);
      expect(obs0.canBet).toBe(true);
      expect(obs0.canCall).toBe(false);
      expect(obs0.canFold).toBe(false);

      state = kuhnPoker.step({ state, playerId: 0, action: "bet", rng: null as any }).state;

      const obs1 = kuhnPoker.observe({ state, playerId: 1 });
      expect(obs1.canCheck).toBe(false);
      expect(obs1.canBet).toBe(false);
      expect(obs1.canCall).toBe(true);
      expect(obs1.canFold).toBe(true);
    });
  });

  describe("results", () => {
    it("should calculate correct payoffs for winner", () => {
      let state = kuhnPoker.reset({ seed: "test", numPlayers: 2 });

      // Check-check showdown
      state = kuhnPoker.step({ state, playerId: 0, action: "check", rng: null as any }).state;
      state = kuhnPoker.step({ state, playerId: 1, action: "check", rng: null as any }).state;

      const results = kuhnPoker.getResults(state);
      const winner = state.winner!;
      const loser = winner === 0 ? 1 : 0;

      expect(results.players[winner].score).toBe(1); // Win opponent's ante
      expect(results.players[loser].score).toBe(-1); // Lose own ante
      expect(results.isDraw).toBe(false);
    });

    it("should calculate correct payoffs for bet-call winner", () => {
      let state = kuhnPoker.reset({ seed: "test", numPlayers: 2 });

      state = kuhnPoker.step({ state, playerId: 0, action: "bet", rng: null as any }).state;
      state = kuhnPoker.step({ state, playerId: 1, action: "call", rng: null as any }).state;

      const results = kuhnPoker.getResults(state);
      const winner = state.winner!;
      const loser = winner === 0 ? 1 : 0;

      expect(results.players[winner].score).toBe(2); // Win opponent's 2 chips
      expect(results.players[loser].score).toBe(-2); // Lose own 2 chips
    });

    it("should calculate correct payoffs for fold", () => {
      let state = kuhnPoker.reset({ seed: "test", numPlayers: 2 });

      state = kuhnPoker.step({ state, playerId: 0, action: "bet", rng: null as any }).state;
      state = kuhnPoker.step({ state, playerId: 1, action: "fold", rng: null as any }).state;

      const results = kuhnPoker.getResults(state);

      // Player 0 wins player 1's ante
      expect(results.players[0].score).toBe(1);
      expect(results.players[1].score).toBe(-1);
      expect(results.winner).toBe(0);
    });
  });

  describe("events", () => {
    it("should emit ACTION event on each action", () => {
      let state = kuhnPoker.reset({ seed: "test", numPlayers: 2 });

      const result = kuhnPoker.step({ state, playerId: 0, action: "bet", rng: null as any });

      expect(result.events).toBeDefined();
      expect(result.events!.some((e) => e.type === "ACTION")).toBe(true);
      const actionEvent = result.events!.find((e) => e.type === "ACTION");
      expect(actionEvent!.data).toEqual({
        playerId: 0,
        action: "bet",
        pot: 3,
      });
    });

    it("should emit HAND_END event on terminal states", () => {
      let state = kuhnPoker.reset({ seed: "test", numPlayers: 2 });

      state = kuhnPoker.step({ state, playerId: 0, action: "check", rng: null as any }).state;
      const result = kuhnPoker.step({ state, playerId: 1, action: "check", rng: null as any });

      expect(result.events!.some((e) => e.type === "HAND_END")).toBe(true);
      const endEvent = result.events!.find((e) => e.type === "HAND_END");
      expect(endEvent!.data.showdown).toBe(true);
      expect(endEvent!.data.pot).toBe(2);
    });
  });
});
