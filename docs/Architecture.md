# Architecture

## Principles

- **Clean Architecture**: domain engine has zero dependencies on UI, network, or storage.
- **Commands only**: all mutations go through `GameEngine` methods (`bid`, `playCard`, `revealTrump`, …).
- **Events**: every meaningful change emits a `GameEvent` for UI / net sync.
- **Explicit FSM**: `GamePhase` with validated transitions.
- **Serializable state**: full round-trip via JSON (`saveGame` / `loadGame`).

## Layers

```
┌─────────────────────────────────────────┐
│  apps/client  (React, Zustand, Motion)  │
│  apps/cli     (readline)                │
└──────────────────┬──────────────────────┘
                   │ commands / events
┌──────────────────▼──────────────────────┐
│  apps/server  (Fastify, Socket.io)      │
│  RoomManager → GameEngine per room      │
│  Prisma / SQLite persistence            │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  packages/shared  (ClientMessage / …)   │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  packages/core                          │
│  entities · rules · fsm · engine · ai   │
└─────────────────────────────────────────┘
```

## Core packages

| Path | Responsibility |
|------|----------------|
| `entities/` | Card, Suit, Rank, Deck, Player, Bid, Trick, Trump, Marriage, Score |
| `rules/` | Bidding, trick resolution, scoring, RuleConfig variants |
| `fsm/` | GamePhase transitions |
| `engine/` | GameEngine, GameState, RNG, serialize |
| `ai/` | Easy / Medium / Hard decision makers + simulation |
| `events/` | EventBus + GameEvent union |

## UI boundary

The React client never encodes suit-follow or scoring logic. It either:

1. Calls local `GameEngine` (offline), or
2. Sends `ClientMessage` over Socket.io and renders `GameStateJSON` (online), computing legal highlights with pure helpers that mirror engine rules.

## Persistence

`GameRecord.stateJson` stores the full engine snapshot. Chat is append-only in `ChatLog`. Rooms are in-memory; reconnect restores socket binding and re-syncs state.
