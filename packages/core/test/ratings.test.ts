import { describe, it, expect } from "vitest";
import {
  expectedScore,
  calculateNewRating,
  createEloRatings,
} from "../src/ratings.js";

describe("Elo Ratings", () => {
  describe("expectedScore", () => {
    it("should return 0.5 for equal ratings", () => {
      expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
    });

    it("should return higher probability for higher rated player", () => {
      const prob = expectedScore(1600, 1500);
      expect(prob).toBeGreaterThan(0.5);
      expect(prob).toBeLessThan(1);
    });

    it("should return lower probability for lower rated player", () => {
      const prob = expectedScore(1400, 1500);
      expect(prob).toBeLessThan(0.5);
      expect(prob).toBeGreaterThan(0);
    });

    it("should be symmetric (probabilities sum to 1)", () => {
      const probA = expectedScore(1600, 1400);
      const probB = expectedScore(1400, 1600);
      expect(probA + probB).toBeCloseTo(1, 5);
    });

    it("should give ~64% for 100 point advantage", () => {
      const prob = expectedScore(1600, 1500);
      expect(prob).toBeCloseTo(0.64, 1);
    });

    it("should give ~76% for 200 point advantage", () => {
      const prob = expectedScore(1700, 1500);
      expect(prob).toBeCloseTo(0.76, 1);
    });
  });

  describe("calculateNewRating", () => {
    it("should increase rating for unexpected win", () => {
      // Lower rated player wins
      const newRating = calculateNewRating(1400, 0.36, 1, 32);
      expect(newRating).toBeGreaterThan(1400);
    });

    it("should decrease rating for loss", () => {
      const newRating = calculateNewRating(1500, 0.5, 0, 32);
      expect(newRating).toBeLessThan(1500);
    });

    it("should change less for expected outcome", () => {
      // Higher rated player wins (expected)
      const expected1 = 0.76;
      const delta1 = calculateNewRating(1700, expected1, 1, 32) - 1700;

      // Lower rated player wins (unexpected)
      const expected2 = 0.24;
      const delta2 = calculateNewRating(1300, expected2, 1, 32) - 1300;

      // Unexpected win should give more points
      expect(Math.abs(delta2)).toBeGreaterThan(Math.abs(delta1));
    });

    it("should respect K-factor", () => {
      const deltaK32 = calculateNewRating(1500, 0.5, 1, 32) - 1500;
      const deltaK16 = calculateNewRating(1500, 0.5, 1, 16) - 1500;

      expect(deltaK32).toBe(deltaK16 * 2);
    });
  });

  describe("createEloRatings", () => {
    it("should initialize new players with default rating", () => {
      const elo = createEloRatings();
      expect(elo.getRating("alice")).toBe(1500);
    });

    it("should initialize with custom initial rating", () => {
      const elo = createEloRatings({ initialRating: 1200 });
      expect(elo.getRating("alice")).toBe(1200);
    });

    it("should update ratings after match", () => {
      const elo = createEloRatings();

      // Equal players, alice wins
      elo.recordMatch("alice", "bob", "alice");

      expect(elo.getRating("alice")).toBeGreaterThan(1500);
      expect(elo.getRating("bob")).toBeLessThan(1500);
    });

    it("should track win/loss/draw counts", () => {
      const elo = createEloRatings();

      elo.recordMatch("alice", "bob", "alice");
      elo.recordMatch("alice", "bob", "bob");
      elo.recordMatch("alice", "bob", null); // draw

      const alice = elo.getPlayer("alice");
      expect(alice.matches).toBe(3);
      expect(alice.wins).toBe(1);
      expect(alice.losses).toBe(1);
      expect(alice.draws).toBe(1);
    });

    it("should return match update details", () => {
      const elo = createEloRatings();

      const update = elo.recordMatch("alice", "bob", "alice");

      expect(update.winnerId).toBe("alice");
      expect(update.loserId).toBe("bob");
      expect(update.winnerOldRating).toBe(1500);
      expect(update.loserOldRating).toBe(1500);
      expect(update.winnerNewRating).toBeGreaterThan(1500);
      expect(update.loserNewRating).toBeLessThan(1500);
      expect(update.winnerDelta).toBeGreaterThan(0);
      expect(update.loserDelta).toBeLessThan(0);
    });

    it("should handle draws correctly", () => {
      const elo = createEloRatings();
      elo.setRating("alice", 1600);
      elo.setRating("bob", 1400);

      // Draw should favor the lower-rated player slightly
      const update = elo.recordMatch("alice", "bob", null);

      expect(elo.getRating("alice")).toBeLessThan(1600);
      expect(elo.getRating("bob")).toBeGreaterThan(1400);
    });

    it("should produce sorted leaderboard", () => {
      const elo = createEloRatings();
      elo.setRating("alice", 1700);
      elo.setRating("bob", 1500);
      elo.setRating("charlie", 1600);

      const leaderboard = elo.getLeaderboard();

      expect(leaderboard[0].playerId).toBe("alice");
      expect(leaderboard[1].playerId).toBe("charlie");
      expect(leaderboard[2].playerId).toBe("bob");
    });

    it("should export and import ratings", () => {
      const elo1 = createEloRatings();
      elo1.recordMatch("alice", "bob", "alice");
      elo1.recordMatch("alice", "charlie", "alice");

      const exported = elo1.export();

      const elo2 = createEloRatings();
      elo2.import(exported);

      expect(elo2.getRating("alice")).toBe(elo1.getRating("alice"));
      expect(elo2.getRating("bob")).toBe(elo1.getRating("bob"));
      expect(elo2.getPlayer("alice").wins).toBe(2);
    });

    it("should use custom K-factor", () => {
      const elo16 = createEloRatings({ kFactor: 16 });
      const elo32 = createEloRatings({ kFactor: 32 });

      elo16.recordMatch("alice", "bob", "alice");
      elo32.recordMatch("alice", "bob", "alice");

      const delta16 = elo16.getRating("alice") - 1500;
      const delta32 = elo32.getRating("alice") - 1500;

      expect(delta32).toBe(delta16 * 2);
    });
  });
});
