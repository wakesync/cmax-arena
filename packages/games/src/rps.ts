/**
 * Rock-Paper-Scissors discipline
 * A simple 2-player game for testing the framework
 */

import type { GameDefinition } from "@cmax/core";

// RPS-specific types
export type RpsAction = "rock" | "paper" | "scissors";

export interface RpsConfig {
  rounds: number;
  showPreviousMoves: boolean;
}

export interface RpsState {
  round: number;
  totalRounds: number;
  showPreviousMoves: boolean;
  scores: [number, number];
  history: Array<{
    moves: [RpsAction | null, RpsAction | null];
    winner: 0 | 1 | null; // null = draw
  }>;
  currentMoves: [RpsAction | null, RpsAction | null];
  phase: "playing" | "finished";
}

export interface RpsObservation {
  round: number;
  totalRounds: number;
  myScore: number;
  opponentScore: number;
  history?: Array<{
    myMove: RpsAction;
    opponentMove: RpsAction;
    result: "win" | "loss" | "draw";
  }>;
}

const DEFAULT_CONFIG: RpsConfig = {
  rounds: 10,
  showPreviousMoves: true,
};

const LEGAL_ACTIONS: RpsAction[] = ["rock", "paper", "scissors"];

function getWinner(move0: RpsAction, move1: RpsAction): 0 | 1 | null {
  if (move0 === move1) return null;

  const wins: Record<RpsAction, RpsAction> = {
    rock: "scissors",
    paper: "rock",
    scissors: "paper",
  };

  return wins[move0] === move1 ? 0 : 1;
}

export const rps: GameDefinition<RpsState, RpsAction, RpsObservation, RpsConfig> = {
  id: "rps",
  version: "1.0.0",
  numPlayers: 2,

  reset({ config, numPlayers }) {
    if (numPlayers !== 2) {
      throw new Error("RPS requires exactly 2 players");
    }

    const merged = { ...DEFAULT_CONFIG, ...config };

    return {
      round: 1,
      totalRounds: merged.rounds,
      showPreviousMoves: merged.showPreviousMoves,
      scores: [0, 0],
      history: [],
      currentMoves: [null, null],
      phase: "playing",
    };
  },

  observe({ state, playerId }) {
    const opponentId = playerId === 0 ? 1 : 0;

    const obs: RpsObservation = {
      round: state.round,
      totalRounds: state.totalRounds,
      myScore: state.scores[playerId],
      opponentScore: state.scores[opponentId],
    };

    if (state.showPreviousMoves && state.history.length > 0) {
      obs.history = state.history.map(
        (h: { moves: [RpsAction | null, RpsAction | null]; winner: 0 | 1 | null }) => {
          const myMove = h.moves[playerId]!;
          const oppMove = h.moves[opponentId]!;
          let result: "win" | "loss" | "draw";

          if (h.winner === null) {
            result = "draw";
          } else if (h.winner === playerId) {
            result = "win";
          } else {
            result = "loss";
          }

          return { myMove, opponentMove: oppMove, result };
        }
      );
    }

    return obs;
  },

  legalActions({ state }) {
    if (state.phase === "finished") {
      return [];
    }
    return [...LEGAL_ACTIONS];
  },

  currentPlayer(state) {
    if (state.phase === "finished") return null;

    // Both players move simultaneously, but we handle sequentially
    // Player 0 moves first if they haven't, then player 1
    if (state.currentMoves[0] === null) return 0;
    if (state.currentMoves[1] === null) return 1;
    return null;
  },

  step({ state, playerId, action }) {
    // Validate action
    if (!LEGAL_ACTIONS.includes(action)) {
      throw new Error(`Invalid action: ${action}`);
    }

    // Record the move
    const newMoves: [RpsAction | null, RpsAction | null] = [
      state.currentMoves[0],
      state.currentMoves[1],
    ];
    newMoves[playerId] = action;

    // If both players have moved, resolve the round
    if (newMoves[0] !== null && newMoves[1] !== null) {
      const winner = getWinner(newMoves[0], newMoves[1]);
      const newScores: [number, number] = [state.scores[0], state.scores[1]];

      if (winner !== null) {
        newScores[winner] += 1;
      }

      const newHistory = [
        ...state.history,
        { moves: newMoves as [RpsAction, RpsAction], winner },
      ];

      const isFinished = state.round >= state.totalRounds;

      return {
        state: {
          ...state,
          round: isFinished ? state.round : state.round + 1,
          scores: newScores,
          history: newHistory,
          currentMoves: [null, null],
          phase: isFinished ? "finished" : "playing",
        } as RpsState,
        events: [
          {
            type: "ROUND_END",
            data: {
              round: state.round,
              moves: { player0: newMoves[0], player1: newMoves[1] },
              winner,
            },
          },
        ],
      };
    }

    // Only one player has moved so far
    return {
      state: {
        ...state,
        currentMoves: newMoves,
      } as RpsState,
    };
  },

  isTerminal(state) {
    return state.phase === "finished";
  },

  getResults(state) {
    const [score0, score1] = state.scores;

    let winner: 0 | 1 | null = null;
    let isDraw = false;

    if (score0 > score1) {
      winner = 0;
    } else if (score1 > score0) {
      winner = 1;
    } else {
      isDraw = true;
    }

    return {
      players: [
        {
          playerId: 0,
          score: score0,
          rank: score0 >= score1 ? 1 : 2,
          stats: {
            wins: score0,
            losses: score1,
            draws: state.totalRounds - score0 - score1,
          },
        },
        {
          playerId: 1,
          score: score1,
          rank: score1 >= score0 ? 1 : 2,
          stats: {
            wins: score1,
            losses: score0,
            draws: state.totalRounds - score0 - score1,
          },
        },
      ],
      winner,
      isDraw,
    };
  },
};
