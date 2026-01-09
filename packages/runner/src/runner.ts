/**
 * Match Runner
 *
 * Executes matches and updates the database with results.
 */

import { supabase, DbMatchEvent } from "./supabase.js";
import { runMatchWithGame } from "./arena.js";
import type { MatchJob } from "./queue.js";

/**
 * Execute a match and update the database
 */
export async function runMatch(job: MatchJob): Promise<void> {
  const startTime = Date.now();
  console.log(`[Runner] Starting match ${job.id}`);
  console.log(`[Runner]   Game: ${job.game_id}`);
  console.log(
    `[Runner]   Agents: ${job.match_agents
      .map((ma) => ma.agents.display_name)
      .join(" vs ")}`
  );

  try {
    // Emit MATCH_START event
    await insertEvent(job.id, "MATCH_START", { timestamp: Date.now() }, 0);

    // Run the match
    const result = await runMatchWithGame({
      gameId: job.game_id,
      agents: job.match_agents
        .sort((a, b) => a.player_id - b.player_id)
        .map((ma) => ({
          id: ma.agent_id,
          kind: ma.agents.kind,
          config: ma.agents.config,
        })),
      seed: job.seed || `seed_${Date.now()}`,
      config: job.config,
      onEvent: async (event, sequence) => {
        // Offset by 1 because MATCH_START is sequence 0
        await insertEvent(
          job.id,
          event.type,
          event as unknown as Record<string, unknown>,
          sequence + 1
        );
      },
    });

    // Emit MATCH_END event
    const finalSequence = await getMaxSequence(job.id);
    await insertEvent(
      job.id,
      "MATCH_END",
      {
        timestamp: Date.now(),
        winner: result.winner,
        isDraw: result.isDraw,
      },
      finalSequence + 1
    );

    // Upload log to storage
    const logPath = `logs/${job.id}.jsonl`;
    const { error: uploadError } = await supabase.storage
      .from("match-logs")
      .upload(logPath, result.log, {
        contentType: "application/x-ndjson",
        upsert: true,
      });

    if (uploadError) {
      console.error(`[Runner] Failed to upload log:`, uploadError);
    }

    // Update match as completed
    const { error: updateError } = await supabase
      .from("matches")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        result: {
          winner: result.winner,
          isDraw: result.isDraw,
          players: result.players,
        },
        log_path: logPath,
      })
      .eq("id", job.id);

    if (updateError) {
      throw updateError;
    }

    // Update Elo ratings
    if (!result.isDraw && result.winner !== null) {
      const winnerId = job.match_agents.find(
        (ma) => ma.player_id === result.winner
      )?.agent_id;
      const loserId = job.match_agents.find(
        (ma) => ma.player_id !== result.winner
      )?.agent_id;

      if (winnerId && loserId) {
        await supabase.rpc("update_elo", {
          p_game_id: job.game_id,
          p_winner_id: winnerId,
          p_loser_id: loserId,
          p_is_draw: false,
        });
      }
    } else if (result.isDraw) {
      // Handle draw - both players get draw update
      const agent1 = job.match_agents[0]?.agent_id;
      const agent2 = job.match_agents[1]?.agent_id;

      if (agent1 && agent2) {
        await supabase.rpc("update_elo", {
          p_game_id: job.game_id,
          p_winner_id: agent1,
          p_loser_id: agent2,
          p_is_draw: true,
        });
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Runner] Match ${job.id} completed in ${duration}s`);
    console.log(
      `[Runner]   Result: ${
        result.isDraw ? "Draw" : `Player ${result.winner} wins`
      }`
    );
  } catch (error) {
    console.error(`[Runner] Match ${job.id} failed:`, error);

    // Update match as failed
    await supabase
      .from("matches")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq("id", job.id);
  }
}

/**
 * Insert a match event into the database
 */
async function insertEvent(
  matchId: string,
  eventType: string,
  eventData: Record<string, unknown>,
  sequence: number
): Promise<void> {
  const event: DbMatchEvent = {
    match_id: matchId,
    event_type: eventType,
    event_data: eventData,
    sequence,
  };

  const { error } = await supabase.from("match_events").insert(event);

  if (error) {
    console.error(`[Runner] Failed to insert event:`, error);
  }
}

/**
 * Get the maximum sequence number for a match
 */
async function getMaxSequence(matchId: string): Promise<number> {
  const { data, error } = await supabase
    .from("match_events")
    .select("sequence")
    .eq("match_id", matchId)
    .order("sequence", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return 0;
  }

  return data.sequence;
}
