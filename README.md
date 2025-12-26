# CMAX Arena

**Circus Maximus Arena Framework** - An open-source adversarial arena framework for AI agents.

[![CI](https://github.com/wakesync/cmax-arena/actions/workflows/ci.yml/badge.svg)](https://github.com/wakesync/cmax-arena/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

CMAX Arena lets developers create and run AI agents in deterministic, replayable sandbox "disciplines" (games/simulations). The framework is:

- **Plugin-based**: Add new arenas by implementing a `GameDefinition` interface
- **Agent-agnostic**: Agents can be rule-based, LLM-backed, multi-model, or remote-hosted
- **Deterministic + Replayable**: Every match produces an event log that can be replayed byte-for-byte
- **Fair**: Enforces per-turn timeouts and supports budget hooks for token/cost tracking

## Quickstart

### Installation

```bash
# Clone the repository
git clone https://github.com/wakesync/cmax-arena.git
cd cmax-arena

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Run a Match

```bash
# Rock-Paper-Scissors with random agents
pnpm --filter @cmax/cli start -- run match --game rps --agents random,random --seed "demo" --rounds 100

# Kuhn Poker
pnpm --filter @cmax/cli start -- run match --game kuhn_poker --agents random,kuhn_rule --seed "demo"
```

### Replay and Verify

```bash
# Verify a match log is deterministic
pnpm --filter @cmax/cli start -- replay --log ./logs/<match-id>.jsonl --verify
```

### Run a Ladder

```bash
# Run multiple matches and compute Elo ratings
pnpm --filter @cmax/cli start -- run ladder --game kuhn_poker --agents random,kuhn_rule --matches 20 --seed "season-1"
```

### Programmatic Usage

```typescript
import { runMatch, runLadder } from "@cmax/core";
import { rps, kuhnPoker } from "@cmax/games";
import { randomAgent, kuhnRuleAgent } from "@cmax/agents";

// Single match
const report = await runMatch(kuhnPoker, [randomAgent, kuhnRuleAgent], {
  seed: "my-match",
});
console.log(`Winner: Player ${report.results.winner}`);

// Ladder tournament
const ladder = await runLadder(rps, [randomAgent, counterAgent], {
  matchesPerPair: 10,
});
console.log(`Leaderboard:`, ladder.leaderboard);
```

See the [examples/](examples/) directory for more usage patterns.

## Packages

| Package | Description |
|---------|-------------|
| `@cmax/core` | Framework core - game loop, events, RNG, ratings, types |
| `@cmax/games` | Built-in game disciplines (RPS, Kuhn Poker) |
| `@cmax/agents` | Reference agents (random, rule-based) |
| `@cmax/cli` | Command line interface |

## Writing a New Game

Implement the `GameDefinition` interface:

```typescript
import { GameDefinition, GameState, Action } from "@cmax/core";

export const myGame: GameDefinition = {
  id: "my_game",
  version: "1.0.0",
  numPlayers: 2,

  reset({ seed, config }) {
    // Initialize game state
  },

  observe({ state, playerId }) {
    // Return player's observation
  },

  legalActions({ state, playerId }) {
    // Return list of legal actions
  },

  step({ state, playerId, action, rng }) {
    // Apply action and return new state
  },

  isTerminal(state) {
    // Return true if game is over
  },

  getResults(state) {
    // Return final scores/winner
  },
};
```

See [docs/game-interface.md](docs/game-interface.md) for full documentation.

## Writing an Agent

Implement the `Agent` interface:

```typescript
import { Agent, DecideInput, DecideOutput } from "@cmax/core";

export const myAgent: Agent = {
  id: "my_agent",
  version: "1.0.0",
  displayName: "My Agent",
  kind: "local",

  async decide(input: DecideInput): Promise<DecideOutput> {
    // Choose an action from input.legalActions
    return { action: input.legalActions[0] };
  },
};
```

See [docs/agent-interface.md](docs/agent-interface.md) for full documentation.

## Documentation

- [Architecture](docs/architecture.md) - Package overview and data flow
- [Game Interface](docs/game-interface.md) - How to implement games
- [Agent Interface](docs/agent-interface.md) - How to implement agents
- [Event Log](docs/event-log.md) - JSONL schema and replay format
- [Determinism](docs/determinism.md) - Seed, RNG, and replay verification
- [Roadmap](docs/roadmap.md) - Future plans

## Built-in Disciplines

### Rock-Paper-Scissors (RPS)
Simple 2-player game for testing. Configurable number of rounds.

### Kuhn Poker
Classic 2-player poker variant used in game theory research. 3-card deck, one betting round.

### Texas Hold'em
Full No-Limit Texas Hold'em poker with 2-6 players. Includes:
- Standard 52-card deck with deterministic shuffle
- All betting rounds (preflop, flop, turn, river)
- Complete hand evaluation (high card to royal flush)
- Side pot support for all-in situations

```bash
# Run a Texas Hold'em match
pnpm --filter @cmax/cli start -- run match --game texas_holdem --agents random,random --seed "poker-night"
```

## Disclaimer

**This framework does not support real-money gambling.** It is designed for AI research, competitions, and educational purposes only.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE](LICENSE)
