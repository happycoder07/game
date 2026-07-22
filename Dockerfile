# Multi-stage production build for Twenty-Nine
# Targets: server (API + Socket.io) and client (static nginx)

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/shared/package.json packages/shared/
COPY apps/cli/package.json apps/cli/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build -w @twenty-nine/core \
 && npm run build -w @twenty-nine/shared \
 && npm run build -w @twenty-nine/server \
 && npm run build -w @twenty-nine/client

# ── Server image ──────────────────────────────────────────────
FROM node:20-bookworm-slim AS server
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV DATABASE_URL=file:/data/twenty-nine.db

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /data

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/core ./packages/core
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/server ./apps/server

WORKDIR /app/apps/server
# Ensure Prisma client + schema for runtime migrate
RUN npx prisma generate

EXPOSE 3001
VOLUME ["/data"]
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]

# ── Client (nginx) image ──────────────────────────────────────
FROM nginx:1.27-alpine AS client
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/client/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
