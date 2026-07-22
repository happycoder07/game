import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import { RoomManager } from './rooms/GameRoom.js';
import { persistRoom, logChat, prisma } from './db/persistence.js';
import type { ClientMessage, ServerMessage } from '@twenty-nine/shared';
import { GameEngine } from '@twenty-nine/core';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const CORS_ORIGIN = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:8080')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function main(): Promise<void> {
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: CORS_ORIGIN.length === 1 ? CORS_ORIGIN[0] : CORS_ORIGIN,
  });

  const rooms = new RoomManager();

  app.get('/health', async () => ({ ok: true, service: 'twenty-nine' }));

  app.get('/api/rooms/:code', async (req, reply) => {
    const code = (req.params as { code: string }).code;
    const room = rooms.get(code);
    if (!room) return reply.code(404).send({ error: 'Not found' });
    return room.toInfo();
  });

  app.get('/api/games/:code', async (req, reply) => {
    const code = (req.params as { code: string }).code;
    const rec = await prisma.gameRecord.findFirst({
      where: { roomCode: code.toUpperCase() },
      orderBy: { updatedAt: 'desc' },
    });
    if (!rec) return reply.code(404).send({ error: 'Not found' });
    return { id: rec.id, finished: rec.finished, winner: rec.winner, updatedAt: rec.updatedAt };
  });

  await app.listen({ port: PORT, host: HOST });

  const io = new Server(app.server, {
    cors: { origin: CORS_ORIGIN },
  });

  function emitToRoom(code: string, exceptSocket: string | null, build: (playerId: string) => ServerMessage): void {
    const room = rooms.get(code);
    if (!room) return;
    for (const p of [...room.players, ...room.spectators]) {
      if (!p.socketId || p.socketId === exceptSocket) continue;
      io.to(p.socketId).emit('message', build(p.id));
    }
  }

  function broadcastState(code: string): void {
    const room = rooms.get(code);
    if (!room) return;
    for (const p of [...room.players, ...room.spectators]) {
      if (!p.socketId) continue;
      io.to(p.socketId).emit('message', room.stateFor(p.id));
    }
    io.to(code).emit('message', { type: 'RoomUpdated', room: room.toInfo() } satisfies ServerMessage);
  }

  io.on('connection', (socket) => {
    socket.on('message', async (raw: ClientMessage) => {
      try {
        switch (raw.type) {
          case 'CreateRoom': {
            const room = rooms.create(raw.name, socket.id);
            room.onPersist = (r) => {
              void persistRoom(r);
            };
            room.onAiStep = () => broadcastState(room.code);
            socket.join(room.code);
            const msg: ServerMessage = {
              type: 'RoomCreated',
              room: room.toInfo(),
              playerId: room.hostId,
            };
            socket.emit('message', msg);
            break;
          }
          case 'JoinRoom': {
            const { room, player } = rooms.join(raw.code, raw.name, socket.id, raw.asSpectator);
            room.onPersist = (r) => {
              void persistRoom(r);
            };
            room.onAiStep = () => broadcastState(room.code);
            socket.join(room.code);
            const stMsg = room.stateFor(player.id);
            socket.emit('message', {
              type: 'ReconnectOk',
              room: room.toInfo(),
              playerId: player.id,
              state: stMsg.type === 'GameState' ? stMsg.state : null,
            } satisfies ServerMessage);
            emitToRoom(room.code, socket.id, () => ({
              type: 'PlayerJoined',
              player: {
                id: player.id,
                name: player.name,
                seat: player.seat,
                kind: player.kind,
                aiLevel: player.aiLevel,
                connected: true,
                isSpectator: player.isSpectator,
              },
            }));
            broadcastState(room.code);
            break;
          }
          case 'Reconnect': {
            const room = rooms.get(raw.code);
            if (!room || !room.reconnect(raw.playerId, socket.id)) {
              socket.emit('message', { type: 'Error', message: 'Reconnect failed' } satisfies ServerMessage);
              break;
            }
            socket.join(room.code);
            const stMsg = room.stateFor(raw.playerId);
            socket.emit('message', {
              type: 'ReconnectOk',
              room: room.toInfo(),
              playerId: raw.playerId,
              state: stMsg.type === 'GameState' ? stMsg.state : null,
            } satisfies ServerMessage);
            broadcastState(room.code);
            break;
          }
          case 'Chat': {
            const room = rooms.findBySocket(socket.id);
            if (!room) break;
            const p =
              room.players.find((x) => x.socketId === socket.id) ||
              room.spectators.find((x) => x.socketId === socket.id);
            if (!p) break;
            await logChat(room.code, p.id, p.name, raw.text);
            const chat: ServerMessage = {
              type: 'ChatMessage',
              playerId: p.id,
              name: p.name,
              text: raw.text,
              at: Date.now(),
            };
            io.to(room.code).emit('message', chat);
            break;
          }
          case 'LeaveRoom': {
            const room = rooms.findBySocket(socket.id);
            if (!room) break;
            const id = room.disconnect(socket.id);
            socket.leave(room.code);
            if (id) {
              io.to(room.code).emit('message', {
                type: 'PlayerLeft',
                playerId: id,
              } satisfies ServerMessage);
              io.to(room.code).emit('message', {
                type: 'RoomUpdated',
                room: room.toInfo(),
              } satisfies ServerMessage);
            }
            break;
          }
          default: {
            const room = rooms.findBySocket(socket.id);
            if (!room) {
              socket.emit('message', { type: 'Error', message: 'Not in a room' } satisfies ServerMessage);
              break;
            }
            const player =
              room.players.find((x) => x.socketId === socket.id) ||
              room.spectators.find((x) => x.socketId === socket.id);
            if (!player) break;

            const extras = room.handle(player.id, raw);
            for (const m of extras) {
              if (m.type === 'Error') socket.emit('message', m);
              else io.to(room.code).emit('message', m);
            }
            broadcastState(room.code);
            break;
          }
        }
      } catch (e) {
        socket.emit('message', {
          type: 'Error',
          message: e instanceof Error ? e.message : String(e),
        } satisfies ServerMessage);
      }
    });

    socket.on('disconnect', () => {
      const room = rooms.findBySocket(socket.id);
      if (!room) return;
      const id = room.disconnect(socket.id);
      if (id) {
        io.to(room.code).emit('message', {
          type: 'PlayerLeft',
          playerId: id,
        } satisfies ServerMessage);
        io.to(room.code).emit('message', {
          type: 'RoomUpdated',
          room: room.toInfo(),
        } satisfies ServerMessage);
      }
    });
  });

  console.log(`Twenty-Nine server on http://${HOST}:${PORT}`);
  void GameEngine;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
