/**
 * Network protocol shared between client and server.
 */
import type { GameStateJSON, Suit, Seat, AiLevel } from '@twenty-nine/core';

export type RoomMode = 'ai' | 'mixed' | 'human' | 'spectator';

export interface RoomInfo {
  code: string;
  hostId: string;
  players: RoomPlayerInfo[];
  spectators: RoomPlayerInfo[];
  started: boolean;
  maxPlayers: number;
}

export interface RoomPlayerInfo {
  id: string;
  name: string;
  seat: Seat | null;
  kind: 'human' | 'ai';
  aiLevel?: AiLevel;
  connected: boolean;
  isSpectator: boolean;
}

/** Client → Server */
export type ClientMessage =
  | { type: 'CreateRoom'; name: string }
  | { type: 'JoinRoom'; code: string; name: string; asSpectator?: boolean }
  | { type: 'LeaveRoom' }
  | { type: 'Sit'; seat: Seat }
  | { type: 'SetAi'; seat: Seat; level: AiLevel }
  | { type: 'SetName'; name: string }
  | { type: 'StartGame' }
  | { type: 'Bid'; value: number }
  | { type: 'Pass' }
  | { type: 'ChooseTrump'; suit: Suit }
  | { type: 'PlayCard'; cardId: string }
  | { type: 'RevealTrump' }
  | { type: 'DeclareMarriage' }
  | { type: 'Double' }
  | { type: 'Redouble' }
  | { type: 'PassChallenge' }
  | { type: 'Chat'; text: string }
  | { type: 'Reconnect'; playerId: string; code: string }
  | { type: 'SyncState' }
  | { type: 'NextRound' };

/** Server → Client */
export type ServerMessage =
  | { type: 'RoomCreated'; room: RoomInfo; playerId: string }
  | { type: 'RoomUpdated'; room: RoomInfo }
  | { type: 'PlayerJoined'; player: RoomPlayerInfo }
  | { type: 'PlayerLeft'; playerId: string }
  | { type: 'ReconnectOk'; room: RoomInfo; playerId: string; state: GameStateJSON | null }
  | { type: 'GameState'; state: GameStateJSON; you: Seat | null }
  | { type: 'SyncState'; state: GameStateJSON; you: Seat | null }
  | { type: 'ChatMessage'; playerId: string; name: string; text: string; at: number }
  | { type: 'Error'; message: string }
  | { type: 'RoundEnd'; summary: string }
  | { type: 'GameFinished'; winner: string };

export const SOCKET_EVENTS = {
  message: 'message',
  connect: 'connect',
  disconnect: 'disconnect',
} as const;
