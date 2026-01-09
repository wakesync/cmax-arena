/**
 * Supabase Client Configuration
 *
 * Provides typed Supabase client and database interfaces.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";

if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL environment variable is required");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required");
}

export const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Type definitions for database tables
export interface DbMatch {
  id: string;
  game_id: string;
  status: "pending" | "running" | "completed" | "failed";
  seed: string | null;
  seed_commit: string | null;
  config: Record<string, unknown>;
  result: Record<string, unknown> | null;
  log_path: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface DbMatchAgent {
  match_id: string;
  agent_id: string;
  player_id: number;
  fingerprint: string | null;
  agents?: DbAgent;
}

export interface DbAgent {
  id: string;
  version: string;
  display_name: string;
  kind: "local" | "remote" | "llm";
  config: Record<string, unknown>;
}

export interface DbMatchEvent {
  id?: number;
  match_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  sequence: number;
  created_at?: string;
}
