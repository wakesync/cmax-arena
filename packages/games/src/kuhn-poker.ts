/**
 * Kuhn Poker - A simplified 2-player poker game
 *
 * Rules:
 * - 3-card deck: Jack (J=1), Queen (Q=2), King (K=3)
 * - Each player antes 1 chip, dealt 1 card each
 * - Player 0 acts first: check or bet 1
 * - After check: Player 1 can check (showdown) or bet 1
 * - After bet: other player can fold or call
 * - Higher card wins at showdown
 */

import type { GameDefinition } from "@cmax/core";
import { createRng } from "@cmax/core";

// Card values
export type KuhnCard = 1 | 2 | 3; // J=1, Q=2, K=3

// Actions
export type KuhnAction = "check" | "bet" | "call" | "fold";

// Game phases
type KuhnPhase =
  | "p0_action" // Player 0's first action
  | "p1_after_check" // Player 1 acts after player 0 checked
  | "p0_after_bet" // Player 0 responds to player 1's bet (after check-bet)
  | "p1_after_bet" // Player 1 responds to player 0's bet
  | "showdown"
  | "folded";

// Kuhn Poker has no special configuration
export type KuhnConfig = Record<string, never>;

export interface KuhnState {
  cards: [KuhnCard, KuhnCard]; // Player cards
  pot: number;
  bets: [number, number]; // Chips each player has put in
  phase: KuhnPhase;
  winner: 0 | 1 | null;
  history: KuhnAction[];
}

export interface KuhnObservation {
  myCard: KuhnCard;
  myCardName: string;
  pot: number;
  myBet: number;
  opponentBet: number;
  history: KuhnAction[];
  canCheck: boolean;
  canBet: boolean;
  canCall: boolean;
  canFold: boolean;
}

const CARD_NAMES: Record<KuhnCard, string> = {
  1: "Jack",
  2: "Queen",
  3: "King",
};

function getLegalActions(phase: KuhnPhase): KuhnAction[] {
  switch (phase) {
    case "p0_action":
      return ["check", "bet"];
    case "p1_after_check":
      return ["check", "bet"];
    case "p0_after_bet":
      return ["call", "fold"];
    case "p1_after_bet":
      return ["call", "fold"];
    default:
      return [];
  }
}

function getCurrentPlayer(phase: KuhnPhase): 0 | 1 | null {
  switch (phase) {
    case "p0_action":
      return 0;
    case "p1_after_check":
      return 1;
    case "p0_after_bet":
      return 0;
    case "p1_after_bet":
      return 1;
    default:
      return null;
  }
}

export const kuhnPoker: GameDefinition<KuhnState, KuhnAction, KuhnObservation, KuhnConfig> = {
  id: "kuhn_poker",
  version: "1.0.0",
  numPlayers: 2,

  reset({ seed, numPlayers }) {
    if (numPlayers !== 2) {
      throw new Error("Kuhn Poker requires exactly 2 players");
    }

    // Create deterministic deck shuffle using provided seed
    const rng = createRng(seed);

    // Shuffle deck and deal
    const deck: KuhnCard[] = [1, 2, 3];
    const shuffled = rng.shuffle(deck);
    const cards: [KuhnCard, KuhnCard] = [shuffled[0], shuffled[1]];

    return {
      cards,
      pot: 2, // Both players ante 1
      bets: [1, 1], // Ante
      phase: "p0_action",
      winner: null,
      history: [],
    };
  },

  observe({ state, playerId }) {
    const pid = playerId as 0 | 1;
    const opponentId = pid === 0 ? 1 : 0;
    const legalActions = getLegalActions(state.phase);
    const myCard: KuhnCard = state.cards[pid];

    return {
      myCard,
      myCardName: CARD_NAMES[myCard] as string,
      pot: state.pot,
      myBet: state.bets[pid],
      opponentBet: state.bets[opponentId],
      history: [...state.history],
      canCheck: legalActions.includes("check"),
      canBet: legalActions.includes("bet"),
      canCall: legalActions.includes("call"),
      canFold: legalActions.includes("fold"),
    };
  },

  legalActions({ state }) {
    return getLegalActions(state.phase);
  },

  currentPlayer(state) {
    return getCurrentPlayer(state.phase);
  },

  step({ state, playerId, action }) {
    const newHistory = [...state.history, action];
    let newPhase = state.phase;
    let newPot = state.pot;
    const newBets: [number, number] = [state.bets[0], state.bets[1]];
    let winner: 0 | 1 | null = null;

    switch (state.phase) {
      case "p0_action":
        if (action === "check") {
          newPhase = "p1_after_check";
        } else if (action === "bet") {
          newBets[0] += 1;
          newPot += 1;
          newPhase = "p1_after_bet";
        }
        break;

      case "p1_after_check":
        if (action === "check") {
          // Showdown
          newPhase = "showdown";
          winner = state.cards[0] > state.cards[1] ? 0 : 1;
        } else if (action === "bet") {
          newBets[1] += 1;
          newPot += 1;
          newPhase = "p0_after_bet";
        }
        break;

      case "p1_after_bet":
        if (action === "fold") {
          newPhase = "folded";
          winner = 0; // Player 0 wins
        } else if (action === "call") {
          newBets[1] += 1;
          newPot += 1;
          newPhase = "showdown";
          winner = state.cards[0] > state.cards[1] ? 0 : 1;
        }
        break;

      case "p0_after_bet":
        if (action === "fold") {
          newPhase = "folded";
          winner = 1; // Player 1 wins
        } else if (action === "call") {
          newBets[0] += 1;
          newPot += 1;
          newPhase = "showdown";
          winner = state.cards[0] > state.cards[1] ? 0 : 1;
        }
        break;
    }

    return {
      state: {
        cards: state.cards,
        pot: newPot,
        bets: newBets,
        phase: newPhase,
        winner,
        history: newHistory,
      } as KuhnState,
      events: [
        {
          type: "ACTION",
          data: { playerId, action, pot: newPot },
        },
        ...(winner !== null
          ? [
              {
                type: "HAND_END",
                data: {
                  winner,
                  pot: newPot,
                  cards: { player0: state.cards[0], player1: state.cards[1] },
                  showdown: newPhase === "showdown",
                },
              },
            ]
          : []),
      ],
    };
  },

  isTerminal(state) {
    return state.phase === "showdown" || state.phase === "folded";
  },

  getResults(state) {
    if (state.winner === null) {
      throw new Error("Game not finished");
    }

    const loser = state.winner === 0 ? 1 : 0;
    const winnerProfit = state.bets[loser]; // Winner gets what loser put in

    return {
      players: [
        {
          playerId: 0,
          score: state.winner === 0 ? winnerProfit : -state.bets[0],
          rank: state.winner === 0 ? 1 : 2,
          stats: {
            card: CARD_NAMES[state.cards[0]],
            actions: state.history.filter((_, i) => i % 2 === 0 || state.history.length <= 2),
          },
        },
        {
          playerId: 1,
          score: state.winner === 1 ? winnerProfit : -state.bets[1],
          rank: state.winner === 1 ? 1 : 2,
          stats: {
            card: CARD_NAMES[state.cards[1]],
            actions: state.history.filter((_, i) => i % 2 === 1 || state.history.length <= 2),
          },
        },
      ],
      winner: state.winner,
      isDraw: false, // Kuhn poker never has draws
    };
  },
};
