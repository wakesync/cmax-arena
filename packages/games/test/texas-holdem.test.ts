/**
 * Texas Hold'em Tests
 */

import { describe, it, expect } from "vitest";
import { texasHoldem, type HoldemState, type Card } from "../src/texas-holdem.js";

describe("Texas Hold'em", () => {
  describe("setup", () => {
    it("should create game with 2 players", () => {
      const state = texasHoldem.reset({
        seed: "test-seed",
        numPlayers: 2,
        config: { startingChips: 1000, smallBlind: 10, bigBlind: 20 },
      });

      expect(state.players.length).toBe(2);
      expect(state.round).toBe("preflop");
      expect(state.communityCards.length).toBe(0);
    });

    it("should deal 2 cards to each player", () => {
      const state = texasHoldem.reset({
        seed: "test-seed-2",
        numPlayers: 3,
        config: { startingChips: 1000, smallBlind: 10, bigBlind: 20 },
      });

      for (const player of state.players) {
        expect(player.hand).not.toBeNull();
        expect(player.hand!.length).toBe(2);
      }
    });

    it("should post blinds correctly", () => {
      const state = texasHoldem.reset({
        seed: "blind-test",
        numPlayers: 3,
        config: { startingChips: 1000, smallBlind: 10, bigBlind: 20 },
      });

      // In 3+ player game: player 1 is SB, player 2 is BB
      expect(state.players[1].bet).toBe(10);
      expect(state.players[1].chips).toBe(990);
      expect(state.players[2].bet).toBe(20);
      expect(state.players[2].chips).toBe(980);
      expect(state.pot).toBe(30);
    });

    it("should use deterministic shuffling", () => {
      const state1 = texasHoldem.reset({
        seed: "deterministic-test",
        numPlayers: 2,
        config: {},
      });

      const state2 = texasHoldem.reset({
        seed: "deterministic-test",
        numPlayers: 2,
        config: {},
      });

      expect(state1.players[0].hand).toEqual(state2.players[0].hand);
      expect(state1.players[1].hand).toEqual(state2.players[1].hand);
      expect(state1.deck).toEqual(state2.deck);
    });
  });

  describe("betting", () => {
    it("should handle fold action", () => {
      const state = texasHoldem.reset({
        seed: "fold-test",
        numPlayers: 2,
        config: { startingChips: 1000, smallBlind: 10, bigBlind: 20 },
      });

      // Player 0 (SB in heads-up) acts first after BB
      // Actually in heads-up, dealer is SB, so player 0 is dealer/SB and acts first preflop
      const result = texasHoldem.step({
        state,
        playerId: state.currentPlayerIndex,
        action: "fold",
        rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
      });

      expect(result.state.handComplete).toBe(true);
      expect(result.state.winners).toContain(1); // Player 1 (BB) wins
    });

    it("should handle check when no bet to call", () => {
      // Create a state where it's valid to check
      let state = texasHoldem.reset({
        seed: "check-test",
        numPlayers: 2,
        config: { startingChips: 1000, smallBlind: 10, bigBlind: 20 },
      });

      // Player 0 calls the big blind
      const callResult = texasHoldem.step({
        state,
        playerId: 0,
        action: "call",
        rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
      });
      state = callResult.state;

      // Player 1 (BB) can check
      const checkResult = texasHoldem.step({
        state,
        playerId: 1,
        action: "check",
        rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
      });

      // Should move to flop
      expect(checkResult.state.round).not.toBe("preflop");
    });

    it("should handle call action", () => {
      const state = texasHoldem.reset({
        seed: "call-test",
        numPlayers: 2,
        config: { startingChips: 1000, smallBlind: 10, bigBlind: 20 },
      });

      const result = texasHoldem.step({
        state,
        playerId: 0,
        action: "call",
        rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
      });

      // SB calls BB, so should have put in 10 more (total 20)
      expect(result.state.players[0].bet).toBe(20);
      expect(result.state.pot).toBe(40); // 10 + 20 + 10 (from call)
    });

    it("should handle raise action", () => {
      const state = texasHoldem.reset({
        seed: "raise-test",
        numPlayers: 2,
        config: { startingChips: 1000, smallBlind: 10, bigBlind: 20 },
      });

      // Player 0 raises
      const result = texasHoldem.step({
        state,
        playerId: 0,
        action: "raise_20",
        rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
      });

      // SB had 10 bet, calls 10 more to match BB (20), then raises 20 = total 40
      expect(result.state.players[0].bet).toBe(40);
      expect(result.state.currentBet).toBe(40);
    });

    it("should handle all-in action", () => {
      const state = texasHoldem.reset({
        seed: "allin-test",
        numPlayers: 2,
        config: { startingChips: 100, smallBlind: 10, bigBlind: 20 },
      });

      const result = texasHoldem.step({
        state,
        playerId: 0,
        action: "all_in",
        rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
      });

      expect(result.state.players[0].chips).toBe(0);
      expect(result.state.players[0].allIn).toBe(true);
    });
  });

  describe("rounds", () => {
    it("should deal 3 cards on flop", () => {
      let state = texasHoldem.reset({
        seed: "flop-test",
        numPlayers: 2,
        config: { startingChips: 1000, smallBlind: 10, bigBlind: 20 },
      });

      // Both players check through preflop
      state = texasHoldem.step({
        state,
        playerId: 0,
        action: "call",
        rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
      }).state;

      state = texasHoldem.step({
        state,
        playerId: 1,
        action: "check",
        rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
      }).state;

      expect(state.round).toBe("flop");
      expect(state.communityCards.length).toBe(3);
    });

    it("should deal 1 card on turn", () => {
      let state = texasHoldem.reset({
        seed: "turn-test",
        numPlayers: 2,
        config: { startingChips: 1000, smallBlind: 10, bigBlind: 20 },
      });

      // Progress through preflop
      state = texasHoldem.step({
        state,
        playerId: 0,
        action: "call",
        rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
      }).state;

      state = texasHoldem.step({
        state,
        playerId: 1,
        action: "check",
        rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
      }).state;

      // Progress through flop
      state = texasHoldem.step({
        state,
        playerId: state.currentPlayerIndex,
        action: "check",
        rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
      }).state;

      state = texasHoldem.step({
        state,
        playerId: state.currentPlayerIndex,
        action: "check",
        rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
      }).state;

      expect(state.round).toBe("turn");
      expect(state.communityCards.length).toBe(4);
    });

    it("should deal 1 card on river", () => {
      let state = texasHoldem.reset({
        seed: "river-test",
        numPlayers: 2,
        config: { startingChips: 1000, smallBlind: 10, bigBlind: 20 },
      });

      // Progress through preflop, flop, turn
      const actions = ["call", "check", "check", "check", "check", "check"];
      for (const action of actions) {
        if (texasHoldem.isTerminal(state)) break;
        state = texasHoldem.step({
          state,
          playerId: state.currentPlayerIndex,
          action,
          rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
        }).state;
      }

      expect(state.round).toBe("river");
      expect(state.communityCards.length).toBe(5);
    });
  });

  describe("game completion", () => {
    it("should complete when one player folds", () => {
      const state = texasHoldem.reset({
        seed: "complete-fold",
        numPlayers: 2,
        config: { startingChips: 1000, smallBlind: 10, bigBlind: 20 },
      });

      const result = texasHoldem.step({
        state,
        playerId: 0,
        action: "fold",
        rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
      });

      expect(texasHoldem.isTerminal(result.state)).toBe(true);
    });

    it("should go to showdown after river betting", () => {
      let state = texasHoldem.reset({
        seed: "showdown-test",
        numPlayers: 2,
        config: { startingChips: 1000, smallBlind: 10, bigBlind: 20 },
      });

      // Play through all rounds with checks/calls
      while (!texasHoldem.isTerminal(state)) {
        const actions = texasHoldem.legalActions({ state, playerId: state.currentPlayerIndex });
        // Prefer check, then call
        const action = actions.includes("check") ? "check" : "call";
        state = texasHoldem.step({
          state,
          playerId: state.currentPlayerIndex,
          action,
          rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
        }).state;
      }

      expect(state.handComplete).toBe(true);
      expect(state.winners).not.toBeNull();
      expect(state.winners!.length).toBeGreaterThan(0);
    });

    it("should return valid results", () => {
      let state = texasHoldem.reset({
        seed: "results-test",
        numPlayers: 2,
        config: { startingChips: 1000, smallBlind: 10, bigBlind: 20 },
      });

      // Play through all rounds
      while (!texasHoldem.isTerminal(state)) {
        const actions = texasHoldem.legalActions({ state, playerId: state.currentPlayerIndex });
        const action = actions.includes("check") ? "check" : "call";
        state = texasHoldem.step({
          state,
          playerId: state.currentPlayerIndex,
          action,
          rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
        }).state;
      }

      const results = texasHoldem.getResults(state);
      expect(results.players.length).toBe(2);
      expect(results.players.every((p) => typeof p.score === "number")).toBe(true);
      expect(results.players.every((p) => typeof p.rank === "number")).toBe(true);
    });
  });

  describe("observation", () => {
    it("should show player their own cards", () => {
      const state = texasHoldem.reset({
        seed: "obs-test",
        numPlayers: 2,
        config: {},
      });

      const obs0 = texasHoldem.observe({ state, playerId: 0 });
      const obs1 = texasHoldem.observe({ state, playerId: 1 });

      expect(obs0.hand).toEqual(state.players[0].hand);
      expect(obs1.hand).toEqual(state.players[1].hand);
      // Players should see different hands
      expect(obs0.hand).not.toEqual(obs1.hand);
    });

    it("should show community cards to all players", () => {
      let state = texasHoldem.reset({
        seed: "community-test",
        numPlayers: 2,
        config: {},
      });

      // Progress to flop
      state = texasHoldem.step({
        state,
        playerId: 0,
        action: "call",
        rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
      }).state;

      state = texasHoldem.step({
        state,
        playerId: 1,
        action: "check",
        rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
      }).state;

      const obs0 = texasHoldem.observe({ state, playerId: 0 });
      const obs1 = texasHoldem.observe({ state, playerId: 1 });

      expect(obs0.communityCards).toEqual(state.communityCards);
      expect(obs1.communityCards).toEqual(state.communityCards);
      expect(obs0.communityCards.length).toBe(3);
    });
  });

  describe("legal actions", () => {
    it("should allow fold, call, raise, all_in preflop", () => {
      const state = texasHoldem.reset({
        seed: "actions-test",
        numPlayers: 2,
        config: { startingChips: 1000, smallBlind: 10, bigBlind: 20 },
      });

      const actions = texasHoldem.legalActions({ state, playerId: 0 });

      expect(actions).toContain("fold");
      expect(actions).toContain("call");
      expect(actions).toContain("all_in");
      expect(actions.some((a: string) => a.startsWith("raise_"))).toBe(true);
    });

    it("should allow check when no bet to call", () => {
      let state = texasHoldem.reset({
        seed: "check-actions",
        numPlayers: 2,
        config: { startingChips: 1000, smallBlind: 10, bigBlind: 20 },
      });

      // Player calls
      state = texasHoldem.step({
        state,
        playerId: 0,
        action: "call",
        rng: null as unknown as ReturnType<typeof import("@cmax/core").createRng>,
      }).state;

      // BB can check
      const actions = texasHoldem.legalActions({ state, playerId: 1 });
      expect(actions).toContain("check");
    });
  });
});
