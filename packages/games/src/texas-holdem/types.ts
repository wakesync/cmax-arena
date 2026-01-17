/**
 * Texas Hold'em Type Definitions
 */

// ============================================================================
// CARDS
// ============================================================================

export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Suit = 'h' | 'd' | 'c' | 's';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type CardString = `${Rank}${Suit}`;

// ============================================================================
// PLAYER
// ============================================================================

export type PlayerStatus =
  | 'waiting'     // Not yet acted this street
  | 'acted'       // Has acted, may act again if raised
  | 'all_in'      // All chips committed
  | 'folded'      // Out of this hand
  | 'sitting_out' // Not in this hand (tournament)
  ;

export interface Player {
  id: number;                 // Seat number (0-5)
  agentId: string;            // External agent ID
  chips: number;              // Current stack
  holeCards: [Card, Card] | null;  // Null if folded/mucked
  currentBet: number;         // Amount bet this STREET
  totalInvested: number;      // Total committed this HAND
  status: PlayerStatus;
  hasActed: boolean;          // Has acted this street
  isButton: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
}

// ============================================================================
// BETTING
// ============================================================================

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export interface BettingState {
  street: Street;
  currentBet: number;         // Amount to call
  minRaise: number;           // Minimum raise amount
  lastRaiser: number | null;  // Player who last raised
  lastAction: TexasHoldemAction | null;
  numRaises: number;          // For cap games
  potBeforeStreet: number;    // For pot-limit calculations
}

// ============================================================================
// POTS
// ============================================================================

export interface Pot {
  amount: number;
  eligiblePlayers: number[];  // Player IDs who can win this pot
  isMain: boolean;
}

// ============================================================================
// ACTIONS
// ============================================================================

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in';

export interface TexasHoldemAction {
  type: ActionType;
  amount?: number;            // For bet/raise
}

export interface LegalAction {
  type: ActionType;
  minAmount?: number;         // For bet/raise
  maxAmount?: number;         // For bet/raise (stack limit)
}

// ============================================================================
// GAME STATE
// ============================================================================

export interface TexasHoldemState {
  // Players
  players: Player[];
  numPlayers: number;

  // Cards
  deck: Card[];
  communityCards: Card[];
  burnCards: Card[];

  // Positions
  buttonPosition: number;

  // Betting
  betting: BettingState;
  pots: Pot[];

  // Turn management
  currentPlayer: number | null;  // Null if hand is over

  // Hand tracking
  handNumber: number;
  isHandComplete: boolean;

  // Config
  config: TexasHoldemConfig;
}

export interface TexasHoldemConfig {
  numPlayers: number;
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  ante?: number;
  maxRaises?: number;         // For limit games
  timeBank?: number;          // Seconds per decision

  // Tournament options
  blindSchedule?: BlindLevel[];
  handsPerLevel?: number;
}

export interface BlindLevel {
  smallBlind: number;
  bigBlind: number;
  ante?: number;
}

// ============================================================================
// OBSERVATIONS (what agents see)
// ============================================================================

export interface TexasHoldemObservation {
  // Your info
  playerId: number;
  holeCards: [Card, Card];
  chips: number;
  currentBet: number;
  position: PositionName;

  // Table info
  communityCards: Card[];
  street: Street;
  pot: number;
  currentBetToCall: number;
  minRaise: number;

  // Opponents (visible info only)
  opponents: OpponentInfo[];

  // History
  actions: ActionRecord[];

  // Legal moves
  legalActions: LegalAction[];
}

export interface OpponentInfo {
  playerId: number;
  agentId: string;
  chips: number;
  currentBet: number;
  status: PlayerStatus;
  position: PositionName;
  // Note: holeCards only revealed at showdown
}

export interface ActionRecord {
  street: Street;
  playerId: number;
  action: TexasHoldemAction;
  potAfter: number;
}

export type PositionName = 'BTN' | 'SB' | 'BB' | 'UTG' | 'UTG+1' | 'MP' | 'MP+1' | 'HJ' | 'CO';

// ============================================================================
// RESULTS
// ============================================================================

export interface HandResult {
  winners: WinnerInfo[];
  showdownPlayers: ShowdownInfo[];
  potDistribution: PotDistribution[];
  handNumber: number;
}

export interface WinnerInfo {
  playerId: number;
  agentId: string;
  amountWon: number;
  hand?: EvaluatedHand;       // If shown
}

export interface ShowdownInfo {
  playerId: number;
  holeCards: [Card, Card];
  bestHand: EvaluatedHand;
}

export interface PotDistribution {
  potIndex: number;
  potAmount: number;
  winners: number[];          // Can be multiple (split pot)
  winningHand?: EvaluatedHand;
}

export interface EvaluatedHand {
  rank: HandRank;
  cards: Card[];              // Best 5 cards
  description: string;        // "Full House, Aces full of Kings"
}

export type HandRank =
  | 'high_card'
  | 'pair'
  | 'two_pair'
  | 'three_of_a_kind'
  | 'straight'
  | 'flush'
  | 'full_house'
  | 'four_of_a_kind'
  | 'straight_flush'
  | 'royal_flush'
  ;

// ============================================================================
// POKERSOLVER TYPES (since @types/pokersolver doesn't exist)
// ============================================================================

export interface PokersolverHand {
  rank: number;
  cards: Array<{ value: string; suit: string }>;
  descr: string;
}

export interface PokersolverStatic {
  solve(cards: string[]): PokersolverHand;
  winners(hands: PokersolverHand[]): PokersolverHand[];
}
