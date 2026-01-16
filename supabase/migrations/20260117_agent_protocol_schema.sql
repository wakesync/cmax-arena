-- ============================================================================
-- Agent Protocol Schema Updates
-- Migration: 20260117_agent_protocol_schema.sql
--
-- Adds support for webhook agents, framework agents, and community features.
-- ============================================================================

-- ============================================================================
-- EXTEND AGENTS TABLE
-- ============================================================================

-- Add new columns for agent ownership and metadata
ALTER TABLE agents ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS trust_level TEXT DEFAULT 'unverified';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS documentation_url TEXT;

-- Add webhook-specific columns
ALTER TABLE agents ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'unknown';

-- Add supported games array
ALTER TABLE agents ADD COLUMN IF NOT EXISTS supported_games TEXT[] DEFAULT '{}';

-- Add timestamps if not exist
ALTER TABLE agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for owner lookup
CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_id);
CREATE INDEX IF NOT EXISTS idx_agents_public ON agents(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_agents_kind ON agents(kind);

-- ============================================================================
-- AGENT OWNERS TABLE (for multi-user support)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_owners (
  id TEXT PRIMARY KEY,
  privy_user_id TEXT UNIQUE,
  email TEXT UNIQUE,
  twitter_username TEXT,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  api_key_hash TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_owners_privy ON agent_owners(privy_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_owners_email ON agent_owners(email);

-- ============================================================================
-- AGENT HEALTH CHECKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_health_checks (
  id BIGSERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  error_message TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_agent ON agent_health_checks(agent_id);
CREATE INDEX IF NOT EXISTS idx_health_time ON agent_health_checks(checked_at DESC);

-- ============================================================================
-- AGENT AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_audit_log (
  id BIGSERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  actor_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_agent ON agent_audit_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON agent_audit_log(created_at DESC);

-- ============================================================================
-- FRAMEWORK CONFIGS TABLE (for Eliza, LangChain, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS framework_configs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  framework TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  character_file TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_framework_agent ON framework_configs(agent_id);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE agent_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE framework_configs ENABLE ROW LEVEL SECURITY;

-- Public read for health checks
CREATE POLICY "Public read health checks"
  ON agent_health_checks FOR SELECT
  USING (true);

-- Service role can manage health checks
CREATE POLICY "Service role manages health checks"
  ON agent_health_checks FOR ALL
  USING (auth.role() = 'service_role');

-- Public read for audit logs (filtered by agent visibility)
CREATE POLICY "Public read audit logs"
  ON agent_audit_log FOR SELECT
  USING (true);

-- Service role can manage audit logs
CREATE POLICY "Service role manages audit logs"
  ON agent_audit_log FOR ALL
  USING (auth.role() = 'service_role');

-- Public read for framework configs (if agent is public)
CREATE POLICY "Public read framework configs"
  ON framework_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = framework_configs.agent_id
      AND agents.is_public = true
    )
  );

-- Service role can manage framework configs
CREATE POLICY "Service role manages framework configs"
  ON framework_configs FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update agent health status
CREATE OR REPLACE FUNCTION update_agent_health(
  p_agent_id TEXT,
  p_status TEXT,
  p_latency_ms INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert health check record
  INSERT INTO agent_health_checks (agent_id, status, latency_ms, error_message)
  VALUES (p_agent_id, p_status, p_latency_ms, p_error_message);

  -- Update agent's health status
  UPDATE agents
  SET
    health_status = p_status,
    last_health_check = NOW()
  WHERE id = p_agent_id;
END;
$$;

-- Function to log agent action
CREATE OR REPLACE FUNCTION log_agent_action(
  p_agent_id TEXT,
  p_action TEXT,
  p_details JSONB DEFAULT NULL,
  p_actor_id TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO agent_audit_log (agent_id, action, details, actor_id)
  VALUES (p_agent_id, p_action, p_details, p_actor_id);
END;
$$;

-- Function to get agent stats
CREATE OR REPLACE FUNCTION get_agent_stats(p_agent_id TEXT)
RETURNS TABLE (
  total_matches BIGINT,
  wins BIGINT,
  losses BIGINT,
  draws BIGINT,
  win_rate NUMERIC,
  avg_rating NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_matches,
    COUNT(*) FILTER (WHERE m.result->>'winner' IS NOT NULL AND
      (m.result->>'winner')::int = ma.player_id)::BIGINT as wins,
    COUNT(*) FILTER (WHERE m.result->>'winner' IS NOT NULL AND
      (m.result->>'winner')::int != ma.player_id AND
      NOT (m.result->>'isDraw')::boolean)::BIGINT as losses,
    COUNT(*) FILTER (WHERE (m.result->>'isDraw')::boolean = true)::BIGINT as draws,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND(
          COUNT(*) FILTER (WHERE m.result->>'winner' IS NOT NULL AND
            (m.result->>'winner')::int = ma.player_id)::NUMERIC /
          COUNT(*)::NUMERIC * 100,
          2
        )
      ELSE 0
    END as win_rate,
    COALESCE((
      SELECT ar.rating
      FROM agent_ratings ar
      WHERE ar.agent_id = p_agent_id
      LIMIT 1
    ), 1500) as avg_rating
  FROM match_agents ma
  JOIN matches m ON m.id = ma.match_id
  WHERE ma.agent_id = p_agent_id
    AND m.status = 'completed';
END;
$$;

-- ============================================================================
-- UPDATE EXISTING AGENTS
-- ============================================================================

-- Set existing LLM agents to have supported_games for all games
UPDATE agents
SET supported_games = ARRAY['rps', 'kuhn_poker', 'texas_holdem']
WHERE kind = 'llm' AND (supported_games IS NULL OR array_length(supported_games, 1) IS NULL);

-- Set existing local agents to have supported games
UPDATE agents
SET supported_games = CASE
  WHEN id = 'random' THEN ARRAY['rps', 'kuhn_poker', 'texas_holdem']
  WHEN id = 'rps_counter' THEN ARRAY['rps']
  WHEN id = 'kuhn_rule' THEN ARRAY['kuhn_poker']
  ELSE ARRAY['rps', 'kuhn_poker', 'texas_holdem']
END
WHERE kind = 'local' AND (supported_games IS NULL OR array_length(supported_games, 1) IS NULL);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE agent_owners IS 'Users who can create and manage agents';
COMMENT ON TABLE agent_health_checks IS 'Health check history for webhook agents';
COMMENT ON TABLE agent_audit_log IS 'Audit trail for agent actions';
COMMENT ON TABLE framework_configs IS 'Configuration for framework-based agents (Eliza, etc.)';

COMMENT ON COLUMN agents.owner_id IS 'Owner user ID (references agent_owners)';
COMMENT ON COLUMN agents.is_public IS 'Whether agent is publicly visible and challengeable';
COMMENT ON COLUMN agents.is_verified IS 'Whether agent has been verified by admins';
COMMENT ON COLUMN agents.trust_level IS 'Trust level: unverified, verified, or official';
COMMENT ON COLUMN agents.webhook_secret IS 'Secret for HMAC signature verification (encrypted)';
COMMENT ON COLUMN agents.health_status IS 'Current health: healthy, unhealthy, timeout, unknown';
COMMENT ON COLUMN agents.supported_games IS 'Array of game IDs this agent can play';
