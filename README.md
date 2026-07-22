# Twenty-Nine (29)

Production-quality implementation of the South Asian card game **Twenty-Nine**.

## Quick start

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
npm install
npm run build:core && npm run build -w @twenty-nine/shared
npm test
npm run cli
```

Dev stack (Vite :5173 + API :3001):

```bash
cd apps/server && npx prisma generate && npx prisma db push && cd ../..
npm run dev
```

## Docker Compose

```bash
docker compose up --build
```

- **UI**: http://localhost:8080
- **API**: http://localhost:3001 (also proxied via nginx)

SQLite persists in volume `tn-data`.

## Multiplayer

1. Create room and share the code
2. Join / spectator join
3. Sit at a compass seat (host can fill with AI)
4. Host starts the match
5. Chat and reconnect are supported

## Layout

```
packages/core     Game engine
packages/shared   Protocol types
apps/cli          Terminal client
apps/server       Fastify + Socket.io + Prisma
apps/client       React + Vite + Framer Motion
docs/             Architecture, rules, AI, networking, API
```

## Simulation

```bash
SIM_GAMES=100000 SIM_LEVEL=hard npm run sim -w @twenty-nine/core
```
