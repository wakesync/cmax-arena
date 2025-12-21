# Agent Interface

Agents in CMAX Arena implement the `Agent` interface to participate in matches.

## Interface

```typescript
interface Agent {
  // Metadata
  id: string;
  version: string;
  displayName: string;
  kind: AgentKind; // "local" | "subprocess" | "remote"
  config: Record<string, unknown>;

  // Decision making
  decide(input: DecideInput): Promise<DecideOutput>;
}
```

## Decision Input

```typescript
interface DecideInput {
  // Match context
  matchId: string;
  gameId: string;
  playerId: number;

  // Game state (from observe())
  observation: Observation;
  legalActions: Action[];

  // Timing
  meta: DecideMeta;
}

interface DecideMeta {
  turnIndex: number;
  clock: Clock;
  budget: Budget;
  timeoutMs: number;
}
```

## Decision Output

```typescript
interface DecideOutput {
  action: Action;   // Must be in legalActions
  reason?: string;  // Optional explanation
}
```

## Example Agents

### Random Agent

```typescript
const randomAgent: Agent = {
  id: "random",
  version: "1.0.0",
  displayName: "Random Agent",
  kind: "local",
  config: {},

  async decide(input) {
    const rng = createRng(`${input.matchId}:${input.meta.turnIndex}`);
    const action = rng.pick(input.legalActions);
    return { action, reason: "Random selection" };
  },
};
```

### Strategy Agent

```typescript
const kuhnRuleAgent: Agent = {
  id: "kuhn_rule",
  version: "1.0.0",
  displayName: "Kuhn Rule Agent",
  kind: "local",
  config: {},

  async decide(input) {
    const obs = input.observation as KuhnObservation;

    // King: always bet/call
    if (obs.myCard === 3) {
      if (obs.canBet) return { action: "bet", reason: "Value bet" };
      if (obs.canCall) return { action: "call", reason: "Call with best" };
    }

    // Jack: always check/fold
    if (obs.myCard === 1) {
      if (obs.canCheck) return { action: "check", reason: "Weak hand" };
      if (obs.canFold) return { action: "fold", reason: "Fold weak" };
    }

    // Queen: cautious play
    return { action: input.legalActions[0] };
  },
};
```

### Counter Agent (RPS)

```typescript
const rpsCounterAgent: Agent = {
  id: "rps_counter",
  version: "1.0.0",
  displayName: "RPS Counter Agent",
  kind: "local",
  config: {},

  async decide(input) {
    const obs = input.observation as RpsObservation;

    // If we have history, counter the opponent's last move
    if (obs.history && obs.history.length > 0) {
      const lastOpponentMove = obs.history[obs.history.length - 1].opponentMove;
      const counter = {
        rock: "paper",
        paper: "scissors",
        scissors: "rock",
      };
      return { action: counter[lastOpponentMove] };
    }

    // First move: random
    return { action: "rock" };
  },
};
```

## Agent Kinds

### Local Agents (`kind: "local"`)

Run in-process with the orchestrator. Best for:
- Simple rule-based strategies
- Testing and development
- Low-latency requirements

### Subprocess Agents (`kind: "subprocess"`)

Run as a separate process, communicating via stdin/stdout. Best for:
- Agents in different languages
- Resource isolation
- Longer computation times

### Remote Agents (`kind: "remote"`)

Run on a remote server, communicating via HTTP/WebSocket. Best for:
- Cloud-hosted agents
- GPU-accelerated models
- Distributed computation

## Timeout Handling

Agents have a configurable timeout (default: 5000ms). If an agent doesn't respond in time:

1. The orchestrator cancels the pending decision
2. The first legal action is used as a fallback
3. The turn event records `timedOut: true`

```typescript
// Agent receives timeout info in meta
async decide(input) {
  const remainingMs = input.meta.timeoutMs;
  // Ensure decision completes within timeout
}
```

## Best Practices

1. **Determinism** - For reproducible matches, use the provided matchId and turnIndex to seed any RNG
2. **Timeout Awareness** - Monitor remaining time and return early if needed
3. **Legal Actions** - Always return an action from `legalActions`
4. **Graceful Degradation** - Have fallback strategies if primary computation fails
5. **Stateless** - Avoid storing state between `decide()` calls; derive from observation
