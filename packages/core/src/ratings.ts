/**
 * Elo Rating System
 *
 * Standard Elo rating calculations for 1v1 matches.
 * See: https://en.wikipedia.org/wiki/Elo_rating_system
 */

export interface EloConfig {
  // K-factor determines how much ratings change per match
  // Higher K = more volatile ratings
  // Common values: 32 (new players), 24 (established), 16 (masters)
  kFactor?: number;

  // Starting rating for new players
  initialRating?: number;
}

export interface PlayerRating {
  playerId: string;
  rating: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface EloUpdate {
  winnerId: string | null; // null for draw
  loserId: string | null;
  winnerOldRating: number;
  loserOldRating: number;
  winnerNewRating: number;
  loserNewRating: number;
  winnerDelta: number;
  loserDelta: number;
}

const DEFAULT_K_FACTOR = 32;
const DEFAULT_INITIAL_RATING = 1500;

/**
 * Calculate expected score (probability of winning) for player A against player B
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new Elo rating after a match
 *
 * @param rating Current rating
 * @param expected Expected score (0-1)
 * @param actual Actual score (1=win, 0.5=draw, 0=loss)
 * @param kFactor K-factor for rating adjustment
 */
export function calculateNewRating(
  rating: number,
  expected: number,
  actual: number,
  kFactor: number = DEFAULT_K_FACTOR
): number {
  return Math.round(rating + kFactor * (actual - expected));
}

/**
 * Create and manage Elo ratings for a set of players
 */
export function createEloRatings(config: EloConfig = {}) {
  const kFactor = config.kFactor ?? DEFAULT_K_FACTOR;
  const initialRating = config.initialRating ?? DEFAULT_INITIAL_RATING;

  const ratings: Map<string, PlayerRating> = new Map();

  function getOrCreate(playerId: string): PlayerRating {
    let player = ratings.get(playerId);
    if (!player) {
      player = {
        playerId,
        rating: initialRating,
        matches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      };
      ratings.set(playerId, player);
    }
    return player;
  }

  return {
    /**
     * Get current rating for a player (creates with initial rating if new)
     */
    getRating(playerId: string): number {
      return getOrCreate(playerId).rating;
    },

    /**
     * Get full player stats
     */
    getPlayer(playerId: string): PlayerRating {
      return { ...getOrCreate(playerId) };
    },

    /**
     * Get all player ratings sorted by rating (descending)
     */
    getLeaderboard(): PlayerRating[] {
      return Array.from(ratings.values())
        .map((p) => ({ ...p }))
        .sort((a, b) => b.rating - a.rating);
    },

    /**
     * Record a match result and update ratings
     *
     * @param player1Id First player ID
     * @param player2Id Second player ID
     * @param winnerId Winner's ID, or null for draw
     */
    recordMatch(
      player1Id: string,
      player2Id: string,
      winnerId: string | null
    ): EloUpdate {
      const p1 = getOrCreate(player1Id);
      const p2 = getOrCreate(player2Id);

      const oldRating1 = p1.rating;
      const oldRating2 = p2.rating;

      const expected1 = expectedScore(p1.rating, p2.rating);
      const expected2 = expectedScore(p2.rating, p1.rating);

      let actual1: number;
      let actual2: number;

      if (winnerId === null) {
        // Draw
        actual1 = 0.5;
        actual2 = 0.5;
        p1.draws++;
        p2.draws++;
      } else if (winnerId === player1Id) {
        actual1 = 1;
        actual2 = 0;
        p1.wins++;
        p2.losses++;
      } else {
        actual1 = 0;
        actual2 = 1;
        p1.losses++;
        p2.wins++;
      }

      p1.rating = calculateNewRating(p1.rating, expected1, actual1, kFactor);
      p2.rating = calculateNewRating(p2.rating, expected2, actual2, kFactor);
      p1.matches++;
      p2.matches++;

      // Determine winner/loser for return value
      const winId = winnerId;
      const loseId = winnerId === null ? null : winnerId === player1Id ? player2Id : player1Id;

      return {
        winnerId: winId,
        loserId: loseId,
        winnerOldRating: winId === player1Id ? oldRating1 : oldRating2,
        loserOldRating: loseId === player1Id ? oldRating1 : oldRating2,
        winnerNewRating: winId === player1Id ? p1.rating : p2.rating,
        loserNewRating: loseId === player1Id ? p1.rating : p2.rating,
        winnerDelta: winId
          ? (winId === player1Id ? p1.rating - oldRating1 : p2.rating - oldRating2)
          : 0,
        loserDelta: loseId
          ? (loseId === player1Id ? p1.rating - oldRating1 : p2.rating - oldRating2)
          : 0,
      };
    },

    /**
     * Set a player's rating directly (for initialization or correction)
     */
    setRating(playerId: string, rating: number): void {
      const player = getOrCreate(playerId);
      player.rating = rating;
    },

    /**
     * Export all ratings as a plain object
     */
    export(): Record<string, PlayerRating> {
      const result: Record<string, PlayerRating> = {};
      for (const [id, rating] of ratings) {
        result[id] = { ...rating };
      }
      return result;
    },

    /**
     * Import ratings from a plain object
     */
    import(data: Record<string, PlayerRating>): void {
      ratings.clear();
      for (const [id, rating] of Object.entries(data)) {
        ratings.set(id, { ...rating });
      }
    },
  };
}

export type EloRatings = ReturnType<typeof createEloRatings>;
