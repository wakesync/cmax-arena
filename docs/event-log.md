# Event Log Format

CMAX Arena uses JSONL (JSON Lines) format for match logs. Each line is a valid JSON object representing an event.

## File Structure

```
logs/
└── match_<id>.jsonl
```

## Event Types

### MATCH_START

First event in every log. Contains match metadata and seed commitment.

```json
{
  "type": "MATCH_START",
  "timestamp": 1234567890123,
  "data": {
    "matchId": "match_abc123_xyz789",
    "gameId": "rps",
    "gameVersion": "1.0.0",
    "seedCommit": "sha256:abc123...",
    "config": {
      "numPlayers": 2,
      "gameConfig": { "rounds": 10 },
      "timeoutMs": 5000
    },
    "agents": [
      { "id": "random", "version": "1.0.0", "displayName": "Random Agent" },
      { "id": "rps_counter", "version": "1.0.0", "displayName": "RPS Counter" }
    ]
  }
}
```

### TURN

Emitted after each game turn. Contains the action and timing information.

```json
{
  "type": "TURN",
  "timestamp": 1234567890456,
  "data": {
    "turnIndex": 0,
    "playerId": 0,
    "action": "rock",
    "actionTimeMs": 0.42,
    "observationHash": "sha256:def456...",
    "timedOut": false
  }
}
```

### MATCH_END

Final event. Contains results and seed reveal for verification.

```json
{
  "type": "MATCH_END",
  "timestamp": 1234567890789,
  "data": {
    "seedReveal": "original-seed-string",
    "totalTurns": 20,
    "totalTimeMs": 15.67,
    "results": {
      "players": [
        { "playerId": 0, "score": 6, "rank": 1, "stats": {} },
        { "playerId": 1, "score": 4, "rank": 2, "stats": {} }
      ],
      "winner": 0,
      "isDraw": false
    }
  }
}
```

### Game Events

Games can emit custom events during `step()`. Common types:

```json
// RPS Round End
{
  "type": "ROUND_END",
  "data": {
    "round": 1,
    "moves": { "player0": "rock", "player1": "scissors" },
    "winner": 0
  }
}

// Kuhn Poker Hand End
{
  "type": "HAND_END",
  "data": {
    "winner": 1,
    "pot": 4,
    "cards": { "player0": "Jack", "player1": "King" },
    "showdown": true
  }
}
```

## Seed Verification

The log uses commit-reveal for seed verification:

1. **MATCH_START** contains `seedCommit: sha256(seed)`
2. **MATCH_END** contains `seedReveal: seed`
3. Verifier checks: `sha256(seedReveal) === seedCommit`

This prevents post-hoc seed manipulation while allowing replay.

## Observation Hashing

Each TURN event includes `observationHash`, which is the SHA256 hash of the observation object. This allows verification that:

1. The same observation was seen during replay
2. Hidden information wasn't leaked

## Example Log

```jsonl
{"type":"MATCH_START","timestamp":1705000000000,"data":{"matchId":"match_test","gameId":"rps","gameVersion":"1.0.0","seedCommit":"sha256:abc123","config":{"numPlayers":2,"gameConfig":{"rounds":2},"timeoutMs":5000},"agents":[{"id":"random","version":"1.0.0","displayName":"Random Agent"},{"id":"random","version":"1.0.0","displayName":"Random Agent"}]}}
{"type":"TURN","timestamp":1705000000001,"data":{"turnIndex":0,"playerId":0,"action":"rock","actionTimeMs":0.3,"observationHash":"sha256:hash1","timedOut":false}}
{"type":"TURN","timestamp":1705000000002,"data":{"turnIndex":1,"playerId":1,"action":"paper","actionTimeMs":0.2,"observationHash":"sha256:hash2","timedOut":false}}
{"type":"TURN","timestamp":1705000000003,"data":{"turnIndex":2,"playerId":0,"action":"scissors","actionTimeMs":0.4,"observationHash":"sha256:hash3","timedOut":false}}
{"type":"TURN","timestamp":1705000000004,"data":{"turnIndex":3,"playerId":1,"action":"scissors","actionTimeMs":0.3,"observationHash":"sha256:hash4","timedOut":false}}
{"type":"MATCH_END","timestamp":1705000000005,"data":{"seedReveal":"test-seed","totalTurns":4,"totalTimeMs":2.5,"results":{"players":[{"playerId":0,"score":0,"rank":1,"stats":{}},{"playerId":1,"score":0,"rank":1,"stats":{}}],"winner":null,"isDraw":true}}}
```

## Reading Logs

```typescript
import { readMatchLog, extractMatchMeta, extractTurns } from "@cmax/core";

const events = readMatchLog("./logs/match_test.jsonl");
const meta = extractMatchMeta(events);
const turns = extractTurns(events);

console.log(`Match: ${meta.matchId}`);
console.log(`Game: ${meta.gameId} v${meta.gameVersion}`);
console.log(`Turns: ${turns.length}`);
```

## Replay Verification

```typescript
import { replayMatch, readMatchLog } from "@cmax/core";
import { rps } from "@cmax/games";

const events = readMatchLog("./logs/match_test.jsonl");
const result = replayMatch(rps, events);

if (result.success) {
  console.log(`Verified ${result.turnsVerified} turns`);
} else {
  console.error("Verification failed:", result.errors);
}
```
