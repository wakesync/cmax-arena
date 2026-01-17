/**
 * @cmax/personality
 *
 * AI Personality System for CMAX Arena
 *
 * Provides:
 * - Agent personalities with traits, voice, and reactions
 * - Table talk generation with LLM support
 * - Drama detection for exciting match moments
 */

export const PERSONALITY_VERSION = "0.1.0";

// Types
export type {
  PersonalityTraits,
  PersonalityStyle,
  PersonalityVoice,
  PersonalityReactions,
  ReactionTrigger,
  Rivalry,
  AgentPersonality,
  TableTalkType,
  TableTalkEvent,
  TableTalkContext,
  DramaType,
  DramaEvent,
  PlayerState,
  GameState,
  Action,
  HandResult,
} from "./types.js";

// Presets
export {
  CLAUDE_PERSONALITY,
  GPT4_PERSONALITY,
  GEMINI_PERSONALITY,
  GROK_PERSONALITY,
  LLAMA_PERSONALITY,
  PERSONALITIES,
  getPersonality,
  getDefaultPersonalityForModel,
  listPersonalities,
} from "./presets.js";

// Table Talk
export {
  TableTalkEngine,
  buildTalkContext,
  type TableTalkConfig,
} from "./table-talk.js";

// Drama Detection
export {
  detectDrama,
  isLikelyBluff,
  calculateDramaSeverity,
  getDramaDescription,
  getClipWorthyEvents,
  sortBySeverity,
  type DramaConfig,
} from "./drama.js";
