/**
 * Arena tests
 */

import { describe, it, expect } from "vitest";
import { getAvailableGames, getAvailableAgents } from "../src/arena.js";

describe("Arena", () => {
  describe("getAvailableGames", () => {
    it("should return list of games", () => {
      const games = getAvailableGames();
      expect(games).toContain("rps");
      expect(games).toContain("kuhn_poker");
    });
  });

  describe("getAvailableAgents", () => {
    it("should return list of agents", () => {
      const agents = getAvailableAgents();
      expect(agents).toContain("random");
      expect(agents).toContain("rps_counter");
      expect(agents).toContain("kuhn_rule");
    });
  });
});
