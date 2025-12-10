// @cmax/games - Built-in game disciplines

export const GAMES_VERSION = "0.1.0";

// Rock-Paper-Scissors
export { rps } from "./rps.js";
export type { RpsAction, RpsConfig, RpsState, RpsObservation } from "./rps.js";

// Kuhn Poker
export { kuhnPoker } from "./kuhn-poker.js";
export type { KuhnCard, KuhnAction, KuhnConfig, KuhnState, KuhnObservation } from "./kuhn-poker.js";

// Game registry
import { rps } from "./rps.js";
import { kuhnPoker } from "./kuhn-poker.js";
import type { GameDefinition } from "@cmax/core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const games: Record<string, GameDefinition<any, any, any, any>> = {
  rps,
  kuhn_poker: kuhnPoker,
};

export function getGame(id: string): GameDefinition | undefined {
  return games[id];
}

export function listGames(): string[] {
  return Object.keys(games);
}
