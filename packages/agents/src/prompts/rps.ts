/**
 * Rock-Paper-Scissors LLM Prompts
 *
 * Game-specific prompts for LLM agents playing RPS.
 */

export interface RPSObservation {
  round: number;
  totalRounds: number;
  myScore: number;
  opponentScore: number;
  history: Array<{
    myMove: string;
    opponentMove: string;
    result: string;
  }>;
}

export const RPS_SYSTEM_PROMPT = `You are playing Rock-Paper-Scissors against an opponent. Your goal is to win as many rounds as possible.

GAME RULES:
- Rock beats Scissors
- Scissors beats Paper
- Paper beats Rock
- Same moves result in a tie

STRATEGY TIPS:
- Look for patterns in opponent's moves
- Consider mixing your plays to be unpredictable
- Winning streaks might indicate patterns to exploit
- After a loss, consider if opponent has a pattern

Respond with EXACTLY one of these:
- rock
- paper
- scissors

Do NOT include any other text, just the move.`;

/**
 * Format an RPS observation into a prompt for the LLM
 */
export function formatRPSObservation(obs: RPSObservation): string {
  const history = obs.history.length > 0
    ? obs.history
        .map(
          (h, i) =>
            `  Round ${i + 1}: You played ${h.myMove}, opponent played ${h.opponentMove} → ${h.result}`
        )
        .join("\n")
    : "  No moves yet - this is the first round";

  // Analyze opponent patterns if enough history
  let patternHint = "";
  if (obs.history.length >= 3) {
    const opponentMoves = obs.history.map((h) => h.opponentMove);
    const lastThree = opponentMoves.slice(-3);

    // Check for repetition
    if (lastThree[0] === lastThree[1] && lastThree[1] === lastThree[2]) {
      patternHint = `\nNote: Opponent has played ${lastThree[0]} three times in a row.`;
    }

    // Check for simple cycle
    if (lastThree[0] !== lastThree[1] && lastThree[1] !== lastThree[2] && lastThree[2] !== lastThree[0]) {
      patternHint = `\nNote: Opponent is varying their moves (no repeats in last 3).`;
    }
  }

  return `CURRENT GAME STATE:
- Round: ${obs.round} of ${obs.totalRounds}
- Your Score: ${obs.myScore}
- Opponent Score: ${obs.opponentScore}

MOVE HISTORY:
${history}${patternHint}

Choose your move (rock, paper, or scissors):`;
}

/**
 * Parse LLM response to extract RPS action
 */
export function parseRPSAction(response: string): string | null {
  const normalized = response.trim().toLowerCase();

  // Direct matches
  if (normalized === "rock") return "rock";
  if (normalized === "paper") return "paper";
  if (normalized === "scissors") return "scissors";

  // Partial matches
  if (normalized.includes("rock")) return "rock";
  if (normalized.includes("paper")) return "paper";
  if (normalized.includes("scissors")) return "scissors";

  return null;
}

/**
 * Analyze opponent's pattern for strategy hints
 */
export function analyzeOpponentPattern(
  history: Array<{ opponentMove: string }>
): {
  suggestedMove: string;
  confidence: number;
  reason: string;
} {
  if (history.length < 2) {
    return {
      suggestedMove: "rock",
      confidence: 0.33,
      reason: "Not enough history, random choice",
    };
  }

  // Count opponent moves
  const counts: Record<string, number> = { rock: 0, paper: 0, scissors: 0 };
  for (const h of history) {
    counts[h.opponentMove] = (counts[h.opponentMove] || 0) + 1;
  }

  // Find most common
  const mostCommon = Object.entries(counts).reduce((a, b) =>
    b[1] > a[1] ? b : a
  )[0];

  // Counter moves
  const counter: Record<string, string> = {
    rock: "paper",
    paper: "scissors",
    scissors: "rock",
  };

  const frequency = counts[mostCommon] / history.length;

  if (frequency > 0.5) {
    return {
      suggestedMove: counter[mostCommon],
      confidence: frequency,
      reason: `Opponent plays ${mostCommon} ${Math.round(frequency * 100)}% of the time`,
    };
  }

  return {
    suggestedMove: counter[mostCommon],
    confidence: 0.4,
    reason: "No strong pattern detected, countering most common move",
  };
}
