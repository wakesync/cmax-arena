/**
 * JSONL event logging for match replay
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MatchEvent, MatchReport } from "./orchestrator.js";

/**
 * Write match report to JSONL file
 * Each event is written as a separate line
 */
export function writeMatchLog(report: MatchReport, logPath: string): void {
  // Ensure directory exists
  const dir = dirname(logPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Write each event as a JSON line
  const lines = report.events.map((event) => JSON.stringify(event));
  writeFileSync(logPath, lines.join("\n") + "\n", "utf8");
}

/**
 * Read match events from JSONL file
 */
export function readMatchLog(logPath: string): MatchEvent[] {
  const content = readFileSync(logPath, "utf8");
  const lines = content.trim().split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line) as MatchEvent);
}

/**
 * Generate default log path for a match
 */
export function getDefaultLogPath(matchId: string, baseDir: string = "./logs"): string {
  return join(baseDir, `${matchId}.jsonl`);
}

/**
 * Extract match metadata from events
 */
export function extractMatchMeta(events: MatchEvent[]): {
  matchId: string;
  gameId: string;
  gameVersion: string;
  seedCommit: string;
  seedReveal?: string;
} | null {
  const startEvent = events.find((e) => e.type === "MATCH_START");
  const endEvent = events.find((e) => e.type === "MATCH_END");

  if (!startEvent || startEvent.type !== "MATCH_START") {
    return null;
  }

  return {
    matchId: startEvent.matchId,
    gameId: startEvent.gameId,
    gameVersion: startEvent.gameVersion,
    seedCommit: startEvent.seedCommit,
    seedReveal: endEvent?.type === "MATCH_END" ? endEvent.seedReveal : undefined,
  };
}

/**
 * Extract turn events from match events
 */
export function extractTurns(events: MatchEvent[]): Array<{
  turnIndex: number;
  playerId: number;
  action: unknown;
  timingMs: number;
  timedOut: boolean;
  illegalAction: boolean;
}> {
  return events
    .filter((e) => e.type === "TURN")
    .map((e) => {
      if (e.type !== "TURN") throw new Error("Invalid event type");
      return {
        turnIndex: e.turnIndex,
        playerId: e.playerId,
        action: e.action,
        timingMs: e.timingMs,
        timedOut: e.timedOut,
        illegalAction: e.illegalAction,
      };
    });
}

/**
 * Create a log writer that appends events incrementally
 */
export function createLogWriter(logPath: string): {
  write: (event: MatchEvent) => void;
  close: () => void;
} {
  // Ensure directory exists
  const dir = dirname(logPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const lines: string[] = [];

  return {
    write(event: MatchEvent) {
      lines.push(JSON.stringify(event));
    },
    close() {
      writeFileSync(logPath, lines.join("\n") + "\n", "utf8");
    },
  };
}

/**
 * Sanitize free-form strings (like agent reason) before logging
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  // Remove control characters except newlines and tabs
  // eslint-disable-next-line no-control-regex
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + "...";
  }

  return sanitized;
}
