import { customAlphabet } from 'nanoid';
import {
  createPlayer,
  GameEngine,
  Seat,
  ALL_SEATS,
  GamePhase,
  decide,
  applyAiDecision,
  type AiLevel,
  type Player,
} from '@twenty-nine/core';
import type {
  ClientMessage,
  RoomInfo,
  RoomPlayerInfo,
  ServerMessage,
} from '@twenty-nine/shared';

const codeGen = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export interface RoomPlayer {
  id: string;
  name: string;
  seat: Seat | null;
  kind: 'human' | 'ai';
  aiLevel?: AiLevel;
  connected: boolean;
  isSpectator: boolean;
  socketId: string | null;
}

export class GameRoom {
  readonly code: string;
  hostId: string;
  players: RoomPlayer[] = [];
  spectators: RoomPlayer[] = [];
  engine: GameEngine | null = null;
  started = false;
  /** Persist callback */
  onPersist?: (room: GameRoom) => void;
  /** Called after each AI step so sockets can broadcast. */
  onAiStep?: (room: GameRoom) => void;
  private aiTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(hostId: string, hostName: string, socketId: string) {
    this.code = codeGen();
    this.hostId = hostId;
    this.players.push({
      id: hostId,
      name: hostName,
      seat: Seat.South,
      kind: 'human',
      connected: true,
      isSpectator: false,
      socketId,
    });
  }

  toInfo(): RoomInfo {
    return {
      code: this.code,
      hostId: this.hostId,
      players: this.players.map(toInfo),
      spectators: this.spectators.map(toInfo),
      started: this.started,
      maxPlayers: 4,
    };
  }

  addPlayer(id: string, name: string, socketId: string, asSpectator: boolean): RoomPlayer {
    if (asSpectator || this.players.length >= 4) {
      const p: RoomPlayer = {
        id,
        name,
        seat: null,
        kind: 'human',
        connected: true,
        isSpectator: true,
        socketId,
      };
      this.spectators.push(p);
      return p;
    }
    const taken = new Set(this.players.map((p) => p.seat));
    const seat = ALL_SEATS.find((s) => !taken.has(s)) ?? null;
    const p: RoomPlayer = {
      id,
      name,
      seat,
      kind: 'human',
      connected: true,
      isSpectator: false,
      socketId,
    };
    this.players.push(p);
    return p;
  }

  sit(playerId: string, seat: Seat): void {
    const p = this.players.find((x) => x.id === playerId);
    if (!p || p.isSpectator) throw new Error('Cannot sit');
    if (this.started) throw new Error('Game already started');
    const occupant = this.players.find((x) => x.seat === seat && x.id !== playerId);
    if (occupant?.kind === 'human') throw new Error('Seat taken');
    if (occupant?.kind === 'ai') {
      this.players = this.players.filter((x) => x.id !== occupant.id);
    }
    p.seat = seat;
  }

  setAi(seat: Seat, level: AiLevel): void {
    // Replace empty seat or existing AI with AI bot
    const existing = this.players.find((p) => p.seat === seat);
    if (existing && existing.kind === 'human' && existing.connected) {
      throw new Error('Seat occupied by human');
    }
    if (existing) {
      existing.kind = 'ai';
      existing.aiLevel = level;
      existing.name = `${seat} Bot (${level})`;
      existing.id = `ai-${seat}`;
      existing.connected = true;
      existing.socketId = null;
    } else {
      this.players.push({
        id: `ai-${seat}`,
        name: `${seat} Bot (${level})`,
        seat,
        kind: 'ai',
        aiLevel: level,
        connected: true,
        isSpectator: false,
        socketId: null,
      });
    }
  }

  fillEmptyWithAi(level: AiLevel = 'medium'): void {
    for (const seat of ALL_SEATS) {
      if (!this.players.some((p) => p.seat === seat)) {
        this.setAi(seat, level);
      }
    }
  }

  startGame(): void {
    this.fillEmptyWithAi('medium');
    if (this.players.filter((p) => p.seat).length !== 4) {
      throw new Error('Need 4 seated players');
    }
    const enginePlayers: Player[] = ALL_SEATS.map((seat) => {
      const p = this.players.find((x) => x.seat === seat)!;
      return createPlayer({
        id: p.id,
        name: p.name,
        seat,
        kind: p.kind,
        aiLevel: p.aiLevel,
      });
    });
    this.engine = new GameEngine(enginePlayers, { allowDouble: true });
    this.engine.startRound();
    this.started = true;
    this.scheduleAi();
  }

  handle(playerId: string, msg: ClientMessage): ServerMessage[] {
    const out: ServerMessage[] = [];
    if (!this.engine && msg.type !== 'StartGame' && msg.type !== 'Sit' && msg.type !== 'SetAi') {
      if (msg.type === 'SyncState') {
        return [{ type: 'RoomUpdated', room: this.toInfo() }];
      }
    }

    const seat = this.players.find((p) => p.id === playerId)?.seat ?? null;

    try {
      switch (msg.type) {
        case 'StartGame':
          if (playerId !== this.hostId) throw new Error('Only host can start');
          this.startGame();
          break;
        case 'Sit':
          this.sit(playerId, msg.seat);
          return [{ type: 'RoomUpdated', room: this.toInfo() }];
        case 'SetAi':
          if (playerId !== this.hostId) throw new Error('Only host');
          this.setAi(msg.seat, msg.level);
          return [{ type: 'RoomUpdated', room: this.toInfo() }];
        case 'Bid':
          this.assertSeat(seat);
          this.engine!.bid(seat!, msg.value);
          break;
        case 'Pass':
          this.assertSeat(seat);
          this.engine!.pass(seat!);
          break;
        case 'ChooseTrump':
          this.assertSeat(seat);
          this.engine!.chooseTrump(seat!, msg.suit);
          break;
        case 'PlayCard':
          this.assertSeat(seat);
          this.engine!.playCard(seat!, msg.cardId);
          break;
        case 'RevealTrump':
          this.assertSeat(seat);
          this.engine!.revealTrump(seat!, 'voluntary');
          break;
        case 'DeclareMarriage':
          this.assertSeat(seat);
          this.engine!.declareMarriage(seat!);
          break;
        case 'Double':
          this.assertSeat(seat);
          this.engine!.double(seat!);
          break;
        case 'Redouble':
          this.assertSeat(seat);
          this.engine!.redouble(seat!);
          break;
        case 'PassChallenge':
          this.assertSeat(seat);
          this.engine!.passChallenge(seat!);
          break;
        case 'SyncState':
          break;
        case 'NextRound': {
          if (!this.engine) throw new Error('No game');
          if (this.engine.getState().phase !== GamePhase.RoundEnd) {
            throw new Error('Not at round end');
          }
          if (playerId !== this.hostId) throw new Error('Only host can deal next round');
          this.engine.startRound();
          this.runAi();
          break;
        }
        default:
          break;
      }
    } catch (e) {
      return [{ type: 'Error', message: e instanceof Error ? e.message : String(e) }];
    }

    this.onPersist?.(this);
    this.scheduleAi();

    if (this.engine) {
      const st = this.engine.getState();
      if (st.phase === GamePhase.RoundEnd) {
        out.push({ type: 'RoundEnd', summary: `NS ${st.scoreboard.ns} – EW ${st.scoreboard.ew}` });
      }
      if (st.phase === GamePhase.Finished) {
        out.push({
          type: 'GameFinished',
          winner: st.scoreboard.winner ?? 'unknown',
        });
      }
    }

    return out;
  }

  /** Emit personalized state for a player. */
  stateFor(playerId: string): ServerMessage {
    if (!this.engine) {
      return { type: 'RoomUpdated', room: this.toInfo() };
    }
    const seat = this.players.find((p) => p.id === playerId)?.seat ?? null;
    const state = seat
      ? this.engine.getPublicState(seat)
      : this.engine.getPublicState();
    // Restore own hand from full state (getPublicState keeps own hand; ensure JSON cards)
    if (seat) {
      const full = this.engine.getState();
      state.players[seat]!.hand = full.players[seat].hand.map((c) => c.toJSON());
    }
    return { type: 'GameState', state, you: seat };
  }

  /**
   * Run at most one AI action, then schedule the next with a delay
   * so clients can animate each thrown card.
   */
  scheduleAi(): void {
    if (this.aiTimer) return;
    if (!this.engine) return;

    const st = this.engine.getState();
    if (
      st.phase === GamePhase.Finished ||
      st.phase === GamePhase.RoundEnd ||
      st.phase === GamePhase.Waiting
    ) {
      return;
    }

    let actor: Seat | null = null;
    if (st.phase === GamePhase.Bidding) actor = st.auction.toAct;
    else if (st.phase === GamePhase.TrumpSelection) actor = st.contractBidder;
    else if (st.phase === GamePhase.Challenge) actor = st.toAct;
    else if (st.phase === GamePhase.Playing) actor = st.toAct;
    if (!actor) return;

    const roomPlayer = this.players.find((p) => p.seat === actor);
    if (!roomPlayer || roomPlayer.kind !== 'ai') return;

    const delay =
      st.phase === GamePhase.Playing
        ? 1400
        : st.phase === GamePhase.Bidding
          ? 1000
          : 1100;

    this.aiTimer = setTimeout(() => {
      this.aiTimer = null;
      this.runOneAiMove();
    }, delay);
  }

  private runOneAiMove(): void {
    if (!this.engine) return;
    const st = this.engine.getState();
    if (
      st.phase === GamePhase.Finished ||
      st.phase === GamePhase.RoundEnd ||
      st.phase === GamePhase.Waiting
    ) {
      return;
    }

    let actor: Seat | null = null;
    if (st.phase === GamePhase.Bidding) actor = st.auction.toAct;
    else if (st.phase === GamePhase.TrumpSelection) actor = st.contractBidder;
    else if (st.phase === GamePhase.Challenge) actor = st.toAct;
    else if (st.phase === GamePhase.Playing) actor = st.toAct;
    if (!actor) return;

    const roomPlayer = this.players.find((p) => p.seat === actor);
    if (!roomPlayer || roomPlayer.kind !== 'ai') return;

    const tricksBefore = st.tricks.length;
    const playsBefore = st.currentTrick?.plays.length ?? 0;
    const phaseBefore = st.phase;
    const level = roomPlayer.aiLevel ?? 'medium';
    try {
      const d = decide(level, this.engine, actor);
      applyAiDecision(this.engine, actor, d);
    } catch {
      return;
    }

    this.onPersist?.(this);
    this.onAiStep?.(this);

    const after = this.engine.getState();
    const trickDone = after.tricks.length > tricksBefore;
    const cardPlayed =
      phaseBefore === GamePhase.Playing &&
      (trickDone || (after.currentTrick?.plays.length ?? 0) > playsBefore);

    const watch = trickDone ? 2500 : cardPlayed ? 1100 : 400;
    this.aiTimer = setTimeout(() => {
      this.aiTimer = null;
      this.scheduleAi();
    }, watch);
  }

  /** @deprecated use scheduleAi — kept for any sync callers */
  runAi(): void {
    this.scheduleAi();
  }

  reconnect(playerId: string, socketId: string): boolean {
    const p =
      this.players.find((x) => x.id === playerId) ||
      this.spectators.find((x) => x.id === playerId);
    if (!p) return false;
    p.connected = true;
    p.socketId = socketId;
    return true;
  }

  disconnect(socketId: string): string | null {
    const p =
      this.players.find((x) => x.socketId === socketId) ||
      this.spectators.find((x) => x.socketId === socketId);
    if (!p) return null;
    p.connected = false;
    p.socketId = null;
    return p.id;
  }

  private assertSeat(seat: Seat | null): asserts seat is Seat {
    if (!seat || !this.engine) throw new Error('Not in game');
  }
}

function toInfo(p: RoomPlayer): RoomPlayerInfo {
  return {
    id: p.id,
    name: p.name,
    seat: p.seat,
    kind: p.kind,
    aiLevel: p.aiLevel,
    connected: p.connected,
    isSpectator: p.isSpectator,
  };
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();

  create(hostName: string, socketId: string): GameRoom {
    const id = `p_${codeGen()}`;
    const room = new GameRoom(id, hostName, socketId);
    this.rooms.set(room.code, room);
    return room;
  }

  get(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  join(
    code: string,
    name: string,
    socketId: string,
    asSpectator = false,
  ): { room: GameRoom; player: RoomPlayer } {
    const room = this.get(code);
    if (!room) throw new Error('Room not found');
    const id = `p_${codeGen()}`;
    const player = room.addPlayer(id, name, socketId, asSpectator);
    return { room, player };
  }

  findBySocket(socketId: string): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (
        room.players.some((p) => p.socketId === socketId) ||
        room.spectators.some((p) => p.socketId === socketId)
      ) {
        return room;
      }
    }
    return undefined;
  }
}
