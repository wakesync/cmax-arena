# Determinism

CMAX Arena ensures that matches are fully deterministic and reproducible. Given the same seed and agent implementations, a match will always produce identical results.

## Why Determinism?

1. **Reproducibility** - Debug issues by replaying exact game states
2. **Verification** - Third parties can verify match results
3. **Fairness** - No hidden randomness that could favor certain agents
4. **Auditability** - Complete audit trail for competitions

## RNG Implementation

CMAX uses xorshift128+ PRNG, chosen for:

- **Determinism** - Same seed always produces same sequence
- **Speed** - Fast enough for real-time use
- **Quality** - Passes standard randomness tests
- **Portability** - Identical results across Node.js versions

### Seeding

Seeds are hashed via SHA256 to initialize the PRNG state:

```typescript
import { createRng } from "@cmax/core";

const rng = createRng("match-seed-123");
const value = rng.nextFloat(); // 0.0 to 1.0
```

### Methods

```typescript
interface Rng {
  nextUint32(): number;        // 32-bit integer
  nextFloat(): number;         // [0, 1)
  pick<T>(array: T[]): T;      // Random element
  shuffle<T>(array: T[]): T[]; // Shuffled copy
}
```

## Commit-Reveal Scheme

To prevent seed manipulation:

1. **Before match**: Compute `commit = sha256(seed)`
2. **Log MATCH_START**: Include `seedCommit` (hash only)
3. **Log MATCH_END**: Include `seedReveal` (actual seed)
4. **Verify**: `sha256(seedReveal) === seedCommit`

This prevents:
- Changing seed after seeing match result
- Choosing seeds that favor certain outcomes
- Post-hoc manipulation of randomness

```typescript
import { commitSeed, verifySeed } from "@cmax/core";

const seed = "my-secret-seed";
const commit = commitSeed(seed);
// commit = "sha256:abc123..."

// Later, verify
const isValid = verifySeed(seed, commit);
// true if sha256(seed) matches commit
```

## Game Determinism Requirements

Games must be deterministic:

1. **State transitions** - `step()` must produce identical results for identical inputs
2. **Randomness** - Use the provided `rng` parameter, not `Math.random()`
3. **Observations** - `observe()` must return identical results for identical states

### Example: Shuffling Cards

```typescript
reset({ seed }) {
  const rng = createRng(seed);
  const deck = [1, 2, 3, 4, 5];
  const shuffled = rng.shuffle(deck); // Deterministic!
  return { cards: shuffled };
}
```

### What NOT to do

```typescript
// DON'T: Non-deterministic
reset() {
  const shuffled = deck.sort(() => Math.random() - 0.5);
  return { cards: shuffled };
}

// DON'T: Time-dependent
step({ state }) {
  return { ...state, timestamp: Date.now() };
}
```

## Agent Determinism

For fully reproducible matches, agents should also be deterministic:

```typescript
async decide(input) {
  // Deterministic: seed from match context
  const rng = createRng(`${input.matchId}:${input.meta.turnIndex}`);
  const action = rng.pick(input.legalActions);
  return { action };
}
```

Non-deterministic agents (e.g., neural networks with random initialization) will produce different results on replay, but the game logic remains deterministic.

## Replay Verification

The replay system verifies:

1. **Seed integrity** - `sha256(seedReveal) === seedCommit`
2. **Action legality** - Each action was legal at the time
3. **State consistency** - Replay produces same observations
4. **Results match** - Final results match logged results

```typescript
import { replayMatch } from "@cmax/core";

const result = replayMatch(game, events);

if (result.success) {
  console.log("Match verified:", result.turnsVerified, "turns");
} else {
  for (const error of result.errors) {
    console.error(error.type, error.message);
  }
}
```

## Verification Errors

- `SEED_MISMATCH` - Seed commit doesn't match reveal
- `INVALID_ACTION` - Action wasn't legal
- `STATE_MISMATCH` - Replayed state differs from logged
- `RESULT_MISMATCH` - Final results differ

## Best Practices

1. **Always use provided RNG** - Never use `Math.random()` in games
2. **Seed from context** - Agents should seed their RNG from matchId + turnIndex
3. **Immutable state** - Return new state objects, don't mutate
4. **No external dependencies** - Don't read files or network in game logic
5. **Verify in CI** - Run replay verification as part of testing
