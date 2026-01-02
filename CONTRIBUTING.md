# Contributing to CMAX Arena

Thank you for your interest in contributing to CMAX Arena!

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Setup

```bash
git clone https://github.com/wakesync/cmax-arena.git
cd cmax-arena
pnpm install
pnpm build
pnpm test
```

## Development Workflow

### Running Commands

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format
```

### Project Structure

```
cmax-arena/
├── packages/
│   ├── core/      # Framework core (game loop, RNG, ratings)
│   ├── games/     # Game disciplines (RPS, Kuhn Poker, Texas Hold'em)
│   ├── agents/    # Reference agents (random, rule-based, LLM)
│   ├── cli/       # Command line interface
│   └── runner/    # Match runner service (Supabase integration)
├── docs/          # Documentation
├── examples/      # Example scripts
└── logs/          # Match logs (gitignored)
```

## Adding a New Discipline (Game)

1. Create a new file in `packages/games/src/`
2. Implement the `GameDefinition` interface
3. Export from `packages/games/src/index.ts`
4. Add tests in `packages/games/test/`
5. Update documentation

### GameDefinition Interface

Your game must implement:

- `id` - Unique identifier (e.g., "chess", "poker")
- `version` - Semver version string
- `numPlayers` - Number of players (or min/max range)
- `reset()` - Initialize game state from seed
- `observe()` - Return player's observation
- `legalActions()` - Return valid actions
- `step()` - Apply action and advance state
- `isTerminal()` - Check if game ended
- `getResults()` - Return final results

## Adding a New Agent

1. Create a new file in `packages/agents/src/`
2. Implement the `Agent` interface
3. Export from `packages/agents/src/index.ts`
4. Add tests in `packages/agents/test/`

### Agent Interface

Your agent must implement:

- `id` - Unique identifier
- `version` - Semver version string
- `displayName` - Human-readable name
- `kind` - "local" or "remote"
- `decide()` - Choose an action given observation and legal actions

## Coding Standards

### TypeScript

- Use strict mode
- Prefer explicit types for public APIs
- Use `unknown` instead of `any` where possible

### Determinism

**This is critical.** All game logic must be deterministic:

- Never use `Math.random()` - use the provided RNG
- Never use `Date.now()` in game state
- All state must be JSON-serializable

### Testing

- Write tests for all new features
- Include edge cases
- Test determinism: same seed = same result

#### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @cmax/core test
pnpm --filter @cmax/games test

# Watch mode
pnpm --filter @cmax/core test:watch
```

#### Determinism Tests

Every game should have determinism tests:

```typescript
it("should produce same result with same seed", () => {
  const result1 = runMatch(game, agents, { seed: "test" });
  const result2 = runMatch(game, agents, { seed: "test" });
  expect(result1.events).toEqual(result2.events);
});
```

## Pull Request Checklist

- [ ] Code builds without errors (`pnpm build`)
- [ ] All tests pass (`pnpm test`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Determinism is preserved (replay verification)
- [ ] Documentation updated if needed
- [ ] Commit messages are clear and descriptive

## Commit Style

Use conventional commits:

```
feat(games): add chess discipline
fix(core): handle timeout edge case
docs: update agent interface guide
test: add RNG determinism tests
chore: update dependencies
```

## Questions?

Open an issue for discussion before starting major changes.
