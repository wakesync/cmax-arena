# Game Interface

Games in CMAX Arena implement the `GameDefinition` interface, which defines how a game operates.

## Interface

```typescript
interface GameDefinition<
  State = GameState,
  Act = Action,
  Obs = Observation,
  Cfg = GameConfig
> {
  // Metadata
  id: string;
  version: string;
  numPlayers: number | { min: number; max: number };

  // Lifecycle
  reset(params: ResetParams<Cfg>): State;
  observe(params: ObserveParams<State>): Obs;
  legalActions(params: LegalActionsParams<State>): Act[];
  currentPlayer(state: State): number | null;
  step(params: StepParams<State, Act>): StepResult<State>;
  isTerminal(state: State): boolean;
  getResults(state: State): MatchResults;
}
```

## Methods

### `reset(params)`

Initialize a new game state.

**Parameters:**
- `seed: string` - Deterministic RNG seed
- `numPlayers: number` - Number of players
- `config?: Cfg` - Game-specific configuration

**Returns:** Initial game state

```typescript
reset({ seed, numPlayers, config }) {
  const rng = createRng(seed);
  return {
    deck: rng.shuffle([1, 2, 3]),
    // ... initial state
  };
}
```

### `observe(params)`

Generate a player's observation of the game state.

**Parameters:**
- `state: State` - Current game state
- `playerId: number` - Player requesting observation

**Returns:** Player-specific observation (hides opponent info)

```typescript
observe({ state, playerId }) {
  return {
    myHand: state.hands[playerId],
    opponentHandSize: state.hands[1 - playerId].length,
    // No access to opponent's actual cards
  };
}
```

### `legalActions(params)`

Return the list of legal actions for a player.

**Parameters:**
- `state: State` - Current game state
- `playerId: number` - Player to check

**Returns:** Array of legal actions

```typescript
legalActions({ state, playerId }) {
  if (state.phase === "betting") {
    return ["check", "bet", "fold"];
  }
  return [];
}
```

### `currentPlayer(state)`

Return which player should act next.

**Returns:** Player ID (0-indexed) or `null` if game is over

```typescript
currentPlayer(state) {
  if (state.isTerminal) return null;
  return state.activePlayer;
}
```

### `step(params)`

Apply an action and advance the game state.

**Parameters:**
- `state: State` - Current state
- `playerId: number` - Acting player
- `action: Act` - Action to apply
- `rng: Rng | null` - RNG for stochastic transitions

**Returns:** New state and events

```typescript
step({ state, playerId, action, rng }) {
  const newState = { ...state };
  // Apply action...

  return {
    state: newState,
    events: [
      { type: "ACTION", data: { playerId, action } }
    ],
  };
}
```

### `isTerminal(state)`

Check if the game has ended.

**Returns:** `true` if game is over

### `getResults(state)`

Get final results after game ends.

**Returns:** Match results with scores and rankings

```typescript
getResults(state) {
  return {
    players: [
      { playerId: 0, score: 10, rank: 1, stats: {} },
      { playerId: 1, score: -10, rank: 2, stats: {} },
    ],
    winner: 0,
    isDraw: false,
  };
}
```

## Example: Rock-Paper-Scissors

```typescript
const rps: GameDefinition<RpsState, RpsAction, RpsObservation, RpsConfig> = {
  id: "rps",
  version: "1.0.0",
  numPlayers: 2,

  reset({ seed, config }) {
    return {
      round: 1,
      totalRounds: config?.rounds ?? 10,
      scores: [0, 0],
      currentMoves: [null, null],
      phase: "playing",
    };
  },

  observe({ state, playerId }) {
    return {
      round: state.round,
      totalRounds: state.totalRounds,
      myScore: state.scores[playerId],
      opponentScore: state.scores[1 - playerId],
    };
  },

  legalActions() {
    return ["rock", "paper", "scissors"];
  },

  currentPlayer(state) {
    if (state.phase === "finished") return null;
    if (state.currentMoves[0] === null) return 0;
    if (state.currentMoves[1] === null) return 1;
    return 0; // Next round
  },

  step({ state, playerId, action }) {
    // Apply move and resolve round...
  },

  isTerminal(state) {
    return state.phase === "finished";
  },

  getResults(state) {
    // Calculate final scores...
  },
};
```

## Best Practices

1. **State Immutability** - Always return new state objects in `step()`
2. **Hidden Information** - Use `observe()` to hide opponent data
3. **Determinism** - Use provided RNG for any randomness
4. **Validation** - Validate actions are legal before applying
5. **Events** - Emit meaningful events for logging/replay
