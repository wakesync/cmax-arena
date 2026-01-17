/**
 * AI Personality Type Definitions
 *
 * Defines the structure for agent personalities, table talk,
 * and drama events in CMAX Arena.
 */

// ============================================================================
// PERSONALITY TRAITS
// ============================================================================

export interface PersonalityTraits {
  /** How confrontational (1-10) */
  aggression: number;
  /** How funny/playful (1-10) */
  humor: number;
  /** How boastful (1-10) */
  arrogance: number;
  /** How composed under pressure (1-10) */
  tilt_resistance: number;
  /** How talkative (1-10) */
  verbosity: number;
  /** How respectful to opponents (1-10) */
  respect: number;
}

export type PersonalityStyle =
  | "aggressive"
  | "calculated"
  | "chaotic"
  | "stoic"
  | "philosopher";

// ============================================================================
// PERSONALITY VOICE
// ============================================================================

export interface PersonalityVoice {
  formality: "casual" | "neutral" | "formal";
  uses_emojis: boolean;
  uses_slang: boolean;
  signature_phrases: string[];
}

// ============================================================================
// PERSONALITY REACTIONS
// ============================================================================

export type ReactionTrigger =
  | "win_big"
  | "lose_big"
  | "successful_bluff"
  | "caught_bluffing"
  | "bad_beat"
  | "all_in_call"
  | "all_in_fold"
  | "opponent_mistake"
  | "own_mistake"
  | "long_tank"
  | "early_game"
  | "heads_up";

export type PersonalityReactions = {
  [K in ReactionTrigger]?: string[];
};

// ============================================================================
// RIVALRIES
// ============================================================================

export interface Rivalry {
  agentId: string;
  type: "friendly" | "hostile" | "respectful";
  special_taunts: string[];
}

// ============================================================================
// FULL PERSONALITY
// ============================================================================

export interface AgentPersonality {
  id: string;
  name: string;
  traits: PersonalityTraits;
  style: PersonalityStyle;
  voice: PersonalityVoice;
  reactions: PersonalityReactions;
  rivalries?: Rivalry[];
}

// ============================================================================
// TABLE TALK
// ============================================================================

export type TableTalkType = "chat" | "reaction" | "taunt" | "thinking";

export interface TableTalkEvent {
  type: TableTalkType;
  agentId: string;
  message: string;
  timestamp: number;
  context?: string;
}

export interface TableTalkContext {
  trigger: ReactionTrigger | string;
  description: string;
  pot: number;
  yourChips: number;
  opponentName?: string;
  opponentId?: string;
  lastAction?: string;
  dramaSeverity: number;
  isInteresting?: boolean;
  street?: string;
  matchId?: string;
}

// ============================================================================
// DRAMA EVENTS
// ============================================================================

export type DramaType =
  | "all_in"
  | "bad_beat"
  | "huge_pot"
  | "comeback"
  | "bluff_success"
  | "bluff_caught"
  | "soul_read"
  | "cooler"
  | "river_drama"
  | "hero_call"
  | "hero_fold";

export interface DramaEvent {
  type: DramaType;
  severity: 1 | 2 | 3;
  description: string;
  involvedPlayers: string[];
  clipWorthy: boolean;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// GAME STATE (minimal interface for drama detection)
// ============================================================================

export interface PlayerState {
  id: number;
  agentId: string;
  chips: number;
  currentBet: number;
  totalInvested: number;
  status: "active" | "folded" | "all_in" | "out";
}

export interface GameState {
  players: PlayerState[];
  pot: number;
  street: string;
  communityCards?: unknown[];
}

export interface Action {
  type: string;
  playerId: number;
  amount?: number;
}

export interface HandResult {
  winner: {
    playerId: number;
    agentId: string;
    chipsAfter: number;
  };
  loser?: {
    playerId: number;
    agentId: string;
    chipsAfter: number;
    amountLost: number;
  };
  winnerHand?: { description: string };
  loserHand?: { description: string };
  potSize: number;
  isBadBeat?: boolean;
  isCooler?: boolean;
  wasBluff?: boolean;
  bluffSucceeded?: boolean;
  bluffer?: string;
  blufferHand?: string;
  wasHeroCall?: boolean;
  caller?: string;
  callerHand?: { description: string };
}
