# Networking

## Transport

Socket.io over WebSocket (polling fallback). Event name: `message`.

Payloads are typed in `@twenty-nine/shared` as `ClientMessage` | `ServerMessage`.

## Room lifecycle

1. `CreateRoom` → `RoomCreated` (6-char code).
2. `JoinRoom` / spectator join → `PlayerJoined` + `RoomUpdated`.
3. Host `StartGame` → empty seats filled with medium AI → engine starts → `GameState` per player.
4. Play commands (`Bid`, `Pass`, `PlayCard`, …) validated server-side on `GameEngine`.
5. After each command, AI seats are advanced; all sockets receive personalized `GameState`.
6. `Reconnect` with `playerId` + `code` restores binding.

## Visibility

`GameEngine.getPublicState(viewer)` hides opponent hands and unrevealed trump (except from chooser).

## Chat

`Chat` → persisted `ChatLog` → `ChatMessage` broadcast to room.

## Docker Compose

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Client (nginx) | http://localhost:8080 |
| Server (direct) | http://localhost:3001 |

Nginx proxies `/socket.io`, `/api`, and `/health` to the server container. Game state SQLite lives in volume `tn-data`.
