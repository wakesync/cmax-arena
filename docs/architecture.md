# Architecture

CMAX Arena is a modular, plugin-based framework for running adversarial AI agent competitions.

## Package Structure

```
packages/
├── core/       # Framework core: orchestrator, RNG, replay, ratings
├── games/      # Game definitions (disciplines)
├── agents/     # Reference agent implementations
└── cli/        # Command-line interface
```

### @cmax/core

The core package provides:

- **Orchestrator** - Runs matches between agents with timeout handling
- **RNG** - Deterministic pseudo-random number generation (xorshift128+)
- **Crypto** - SHA256 hashing and commit-reveal for seeds
- **Replay** - Verify determinism by replaying match logs
- **Ratings** - Elo rating system for tracking agent performance
- **Ladder** - Round-robin tournament runner
- **Logging** - JSONL event logging for match records

### @cmax/games

Game definitions implementing the `GameDefinition` interface:

- **rps** - Rock-Paper-Scissors with configurable rounds
- **kuhn_poker** - Simplified 2-player poker game

### @cmax/agents

Reference agent implementations:

- **random** - Uniformly random action selection
- **rps_counter** - Counter-strategy for RPS
- **kuhn_rule** - Rule-based Kuhn Poker player

### @cmax/cli

Command-line interface for running matches and tournaments:

```bash
cmax run match --game rps --agents random,rps_counter
cmax run ladder --game kuhn_poker --agents random,kuhn_rule
cmax replay --log ./logs/match.jsonl --verify
cmax list games
cmax list agents
```

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                     Orchestrator                         │
│                                                         │
│  ┌──────────────┐                    ┌──────────────┐  │
│  │   Agent 0    │◄──observe()────────│              │  │
│  │              │────decide()───────►│    Game      │  │
│  └──────────────┘                    │  Definition  │  │
│                                      │              │  │
│  ┌──────────────┐                    │  - reset()   │  │
│  │   Agent 1    │◄──observe()────────│  - step()    │  │
│  │              │────decide()───────►│  - terminal? │  │
│  └──────────────┘                    └──────────────┘  │
│                                                         │
│                    ▼                                    │
│              Event Logger ──────► match.jsonl           │
└─────────────────────────────────────────────────────────┘
```

## Determinism

All game logic is deterministic given the same seed. The RNG uses xorshift128+ seeded via SHA256 hash of the seed string. This ensures:

1. **Reproducibility** - Same seed produces identical matches
2. **Verifiability** - Matches can be replayed and verified
3. **Auditability** - Event logs capture all state transitions

See [determinism.md](./determinism.md) for implementation details.

## Extension Points

### Adding Games

Implement the `GameDefinition` interface in `@cmax/games`:

```typescript
const myGame: GameDefinition<State, Action, Observation, Config> = {
  id: "my_game",
  version: "1.0.0",
  numPlayers: 2,
  reset(params) { /* ... */ },
  observe(params) { /* ... */ },
  legalActions(params) { /* ... */ },
  currentPlayer(state) { /* ... */ },
  step(params) { /* ... */ },
  isTerminal(state) { /* ... */ },
  getResults(state) { /* ... */ },
};
```

### Adding Agents

Implement the `Agent` interface in `@cmax/agents`:

```typescript
const myAgent: Agent = {
  id: "my_agent",
  version: "1.0.0",
  displayName: "My Agent",
  kind: "local",
  config: {},
  async decide(input) {
    // Return { action, reason? }
  },
};
```
