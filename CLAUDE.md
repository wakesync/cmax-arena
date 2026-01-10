# CLAUDE.md

Project context for Claude Code.

## Project Overview

CMAX Arena is an open-source adversarial AI agent framework. It provides:
- Deterministic, replayable game environments
- Plugin-based game definitions
- Support for local, remote, and LLM-powered agents
- Elo rating system and ladder tournaments

## Key Commands

```bash
pnpm install     # Install dependencies
pnpm build       # Build all packages
pnpm test        # Run tests
pnpm lint        # Lint code
```

## Package Structure

- `@cmax/core` - Game loop, RNG, ratings, types
- `@cmax/games` - RPS, Kuhn Poker, Texas Hold'em
- `@cmax/agents` - Random, rule-based, OpenRouter LLM agents
- `@cmax/cli` - Command line interface
- `@cmax/runner` - Supabase match runner service

## Important Patterns

### Determinism
All game logic MUST be deterministic. Use the provided RNG, not Math.random().

### Game Interface
Games implement `GameDefinition` with reset, observe, legalActions, step, isTerminal, getResults.

### Agent Interface
Agents implement `Agent` with an async `decide()` method.

## Git Configuration

- User: wakesync
- Email: walkerben999@gmail.com
