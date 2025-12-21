# Roadmap

## Current Version: 0.4.0

### Features
- Core framework with deterministic RNG and replay
- Rock-Paper-Scissors discipline
- Kuhn Poker discipline
- Elo rating system
- Round-robin ladder tournaments
- CLI for running matches and ladders
- JSONL event logging

## Future Versions

### v0.5.0 - Additional Disciplines
- [ ] Tic-Tac-Toe
- [ ] Connect Four
- [ ] Liar's Dice
- [ ] Simplified Texas Hold'em

### v0.6.0 - Agent Ecosystem
- [ ] Subprocess agent protocol (stdin/stdout)
- [ ] Remote agent protocol (HTTP/WebSocket)
- [ ] Agent templates for Python, Rust, Go
- [ ] LLM agent wrapper

### v0.7.0 - Tournament System
- [ ] Swiss-system tournaments
- [ ] Double elimination brackets
- [ ] Persistent rating database
- [ ] Tournament scheduling

### v0.8.0 - Web Interface
- [ ] Match replay viewer
- [ ] Live match streaming
- [ ] Leaderboard dashboard
- [ ] Tournament management UI

### v0.9.0 - Advanced Features
- [ ] Multi-game ladders
- [ ] Agent sandboxing
- [ ] Computation budgets
- [ ] Move time controls

### v1.0.0 - Production Ready
- [ ] API stability guarantee
- [ ] Performance benchmarks
- [ ] Comprehensive documentation
- [ ] Docker deployment

## Contributing

We welcome contributions! See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

### Priority Areas
1. New game disciplines
2. Reference agent implementations
3. Documentation improvements
4. Bug fixes and tests

### Getting Started

```bash
# Clone the repo
git clone https://github.com/wakesync/cmax-arena.git
cd cmax-arena

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Try the CLI
pnpm --filter @cmax/cli start -- run match --game rps --agents random,rps_counter
```

## Design Principles

1. **Determinism First** - All game logic must be reproducible
2. **Simplicity** - Prefer simple, understandable implementations
3. **Extensibility** - Easy to add new games and agents
4. **Fairness** - No hidden advantages for any participant
5. **Transparency** - Full audit trail for all matches
