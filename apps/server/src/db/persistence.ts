import { PrismaClient } from '@prisma/client';
import type { GameRoom } from '../rooms/GameRoom.js';

export const prisma = new PrismaClient();

export async function persistRoom(room: GameRoom): Promise<void> {
  if (!room.engine) return;
  const stateJson = room.engine.saveGame();
  const playersJson = JSON.stringify(room.toInfo().players);

  const existing = await prisma.gameRecord.findFirst({
    where: { roomCode: room.code, finished: false },
    orderBy: { updatedAt: 'desc' },
  });

  const finished = room.engine.getState().phase === 'Finished';
  const winner = room.engine.getState().scoreboard.winner;

  if (existing) {
    await prisma.gameRecord.update({
      where: { id: existing.id },
      data: {
        stateJson,
        playersJson,
        finished,
        winner: winner ?? null,
      },
    });
  } else {
    await prisma.gameRecord.create({
      data: {
        roomCode: room.code,
        stateJson,
        playersJson,
        finished,
        winner: winner ?? null,
      },
    });
  }
}

export async function loadLatestGame(roomCode: string): Promise<string | null> {
  const rec = await prisma.gameRecord.findFirst({
    where: { roomCode },
    orderBy: { updatedAt: 'desc' },
  });
  return rec?.stateJson ?? null;
}

export async function logChat(
  roomCode: string,
  playerId: string,
  name: string,
  text: string,
): Promise<void> {
  await prisma.chatLog.create({
    data: { roomCode, playerId, name, text },
  });
}
