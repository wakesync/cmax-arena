/**
 * Job Queue
 *
 * Polls Supabase for pending matches and claims them atomically.
 */

import { supabase, DbMatch } from "./supabase.js";

const POLL_INTERVAL_MS = 5000;
const MAX_CONCURRENT_MATCHES = 1;

let activeMatches = 0;

export interface MatchJob extends DbMatch {
  match_agents: Array<{
    player_id: number;
    agent_id: string;
    fingerprint: string | null;
    agents: {
      id: string;
      display_name: string;
      version: string;
      kind: string;
      config: Record<string, unknown>;
    };
  }>;
}

/**
 * Poll for pending matches and claim them atomically
 */
export async function pollForJobs(): Promise<MatchJob[]> {
  if (activeMatches >= MAX_CONCURRENT_MATCHES) {
    return [];
  }

  // Find and claim a pending match atomically
  const { data: matches, error: findError } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (findError) {
    console.error("Error finding pending matches:", findError);
    return [];
  }

  if (!matches || matches.length === 0) {
    return [];
  }

  const matchId = matches[0].id;

  // Attempt to claim the match (atomic update)
  const { data: claimed, error: claimError } = await supabase
    .from("matches")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .eq("status", "pending") // Only claim if still pending
    .select(
      `
      *,
      match_agents (
        player_id,
        agent_id,
        fingerprint,
        agents (
          id,
          display_name,
          version,
          kind,
          config
        )
      )
    `
    )
    .single();

  if (claimError || !claimed) {
    // Another runner may have claimed it
    return [];
  }

  activeMatches++;
  return [claimed as MatchJob];
}

/**
 * Mark a match as complete (called after successful execution)
 */
export function releaseJob(): void {
  activeMatches = Math.max(0, activeMatches - 1);
}

/**
 * Start the polling loop
 */
export function startPolling(
  onJob: (job: MatchJob) => Promise<void>
): NodeJS.Timeout {
  console.log(`Starting job polling (interval: ${POLL_INTERVAL_MS}ms)`);

  return setInterval(async () => {
    try {
      const jobs = await pollForJobs();

      for (const job of jobs) {
        console.log(`[Queue] Claimed match: ${job.id} (game: ${job.game_id})`);

        try {
          await onJob(job);
        } catch (error) {
          console.error(`[Queue] Error processing match ${job.id}:`, error);
        } finally {
          releaseJob();
        }
      }
    } catch (error) {
      console.error("[Queue] Polling error:", error);
    }
  }, POLL_INTERVAL_MS);
}
