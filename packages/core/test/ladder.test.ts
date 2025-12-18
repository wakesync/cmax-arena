import { describe, it, expect } from "vitest";
import { runLadder, runMatchups } from "../src/ladder.js";
import type { GameDefinition } from "../src/game.js";
import type { Agent } from "../src/agent.js";

// Simple test game: coin flip
const coinFlipGame: GameDefinition = {
  id: "coin_flip",
  version: "1.0.0",
  numPlayers: 2,

  reset({ seed }) {
    // Use seed to determine winner
    const winner = seed.charCodeAt(0) % 2;
    return { winner, decided: false };
  },

  observe({ state }) {
    return { decided: state.decided };
  },

  legalActions() {
    return ["flip"];
  },

  currentPlayer(state) {
    return state.decided ? null : 0;
  },

  step({ state }) {
    return {
      state: { ...state, decided: true },
      events: [],
    };
  },

  isTerminal(state) {
    return state.decided;
  },

  getResults(state) {
    return {
      players: [
        { playerId: 0, score: state.winner === 0 ? 1 : 0, rank: state.winner === 0 ? 1 : 2, stats: {} },
        { playerId: 1, score: state.winner === 1 ? 1 : 0, rank: state.winner === 1 ? 1 : 2, stats: {} },
      ],
      winner: state.winner,
      isDraw: false,
    };
  },
};

const createTestAgent = (id: string): Agent => ({
  id,
  version: "1.0.0",
  displayName: `Agent ${id}`,
  kind: "local",
  config: {},
  async decide({ legalActions }) {
    return { action: legalActions[0] };
  },
});

describe("Ladder Runner", () => {
  describe("runLadder", () => {
    it("should run round-robin matches", async () => {
      const agents = [
        createTestAgent("alice"),
        createTestAgent("bob"),
        createTestAgent("charlie"),
      ];

      const result = await runLadder(coinFlipGame, agents, {
        seed: "test-ladder",
      });

      // 3 agents = 3 pairs = 3 matches
      expect(result.matches).toHaveLength(3);
      expect(result.stats.totalMatches).toBe(3);
    });

    it("should run multiple matches per pair", async () => {
      const agents = [createTestAgent("alice"), createTestAgent("bob")];

      const result = await runLadder(coinFlipGame, agents, {
        seed: "test",
        matchesPerPair: 4,
      });

      // 1 pair × 4 matches = 4 total
      expect(result.matches).toHaveLength(4);
    });

    it("should track Elo ratings", async () => {
      const agents = [createTestAgent("alice"), createTestAgent("bob")];

      const result = await runLadder(coinFlipGame, agents, {
        seed: "test",
      });

      // Ratings should have been updated
      const leaderboard = result.leaderboard;
      expect(leaderboard).toHaveLength(2);

      // Winner should have higher rating
      const winner = result.matches[0].winnerId!;
      const winnerRating = result.ratings.getRating(winner);
      expect(winnerRating).toBeGreaterThan(1500);
    });

    it("should call onMatchComplete callback", async () => {
      const agents = [createTestAgent("alice"), createTestAgent("bob")];
      const completed: string[] = [];

      await runLadder(coinFlipGame, agents, {
        seed: "test",
        onMatchComplete: (result) => {
          completed.push(result.match.matchId);
        },
      });

      expect(completed).toHaveLength(1);
    });

    it("should provide rating update details", async () => {
      const agents = [createTestAgent("alice"), createTestAgent("bob")];

      const result = await runLadder(coinFlipGame, agents, { seed: "test" });
      const update = result.matches[0].ratingUpdate;

      expect(update.player1Before).toBe(1500);
      expect(update.player2Before).toBe(1500);
      expect(update.player1After).not.toBe(update.player1Before);
      expect(update.player2After).not.toBe(update.player2Before);
    });
  });

  describe("runMatchups", () => {
    it("should run specific matchups", async () => {
      const alice = createTestAgent("alice");
      const bob = createTestAgent("bob");
      const charlie = createTestAgent("charlie");

      const result = await runMatchups(
        coinFlipGame,
        [
          [alice, bob],
          [bob, charlie],
        ],
        { seed: "test" }
      );

      expect(result.matches).toHaveLength(2);
      expect(result.matches[0].player1).toBe("alice");
      expect(result.matches[0].player2).toBe("bob");
      expect(result.matches[1].player1).toBe("bob");
      expect(result.matches[1].player2).toBe("charlie");
    });
  });
});
