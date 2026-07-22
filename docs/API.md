# API

## GameEngine (core)

```ts
const engine = new GameEngine(players, rules?, { dealer?, maxUndo? });

engine.startRound();
engine.bid(seat, value);
engine.pass(seat);
engine.chooseTrump(seat, suit);
engine.double(seat);
engine.redouble(seat);
engine.passChallenge(seat);
engine.playCard(seat, cardId);
engine.revealTrump(seat, reason?);
engine.declareMarriage(seat);
engine.undo(steps?);
engine.saveGame(): string;
GameEngine.loadGame(json): GameEngine;

engine.getLegalMoves(seat): string[];
engine.getLegalBids(seat): number[];
engine.getState(): Readonly<GameState>;
engine.getPublicState(viewer?: Seat): GameStateJSON;
engine.subscribe(listener): unsubscribe;
```

## Socket messages

See `packages/shared/src/index.ts` for the full discriminated unions.

### Client → Server (selected)

| type | fields |
|------|--------|
| CreateRoom | name |
| JoinRoom | code, name, asSpectator? |
| StartGame | — |
| Bid | value |
| Pass | — |
| ChooseTrump | suit |
| PlayCard | cardId |
| RevealTrump | — |
| DeclareMarriage | — |
| Chat | text |
| Reconnect | playerId, code |

### Server → Client (selected)

| type | purpose |
|------|---------|
| RoomCreated / RoomUpdated | lobby |
| GameState / SyncState | personalized snapshot |
| ChatMessage | chat |
| Error | rejection |
| GameFinished | match over |

## REST

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | liveness |
| GET | /api/rooms/:code | room info |
| GET | /api/games/:code | latest DB game meta |
