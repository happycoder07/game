import { create } from 'zustand';
import {
  createPlayer,
  GameEngine,
  Seat,
  Suit,
  GamePhase,
  decide,
  applyAiDecision,
  type AiLevel,
  type GameStateJSON,
  serializeState,
  type GameEvent,
} from '@twenty-nine/core';
import type { RoomInfo, ServerMessage, ClientMessage } from '@twenty-nine/shared';
import { io, type Socket } from 'socket.io-client';

export type PlayMode = 'local' | 'online';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';

/** Real-match pacing — each thrown card must be clearly visible. */
export const AI_DELAY = {
  bid: 1000,
  trump: 1200,
  challenge: 900,
  /** Thinking time before an AI card is played. */
  play: 1400,
  /** Time to watch the card fly onto the table after it is played. */
  throwWatch: 1000,
  /** Hold completed trick before the next lead. */
  afterTrick: 2500,
} as const;

interface GameStore {
  mode: PlayMode;
  engine: GameEngine | null;
  snapshot: GameStateJSON | null;
  you: Seat;
  events: GameEvent[];
  dark: boolean;
  socket: Socket | null;
  connected: boolean;
  room: RoomInfo | null;
  playerId: string | null;
  chat: { name: string; text: string; at: number; playerId?: string }[];
  error: string | null;
  aiLevel: AiLevel;
  toast: string | null;
  aiThinking: boolean;
  /** Online: card id waiting for server GameState ack (blocks double-play / flicker). */
  pendingPlay: string | null;

  setDark: (v: boolean) => void;
  setAiLevel: (l: AiLevel) => void;
  clearError: () => void;
  startLocal: (level?: AiLevel) => void;
  refresh: () => void;
  bid: (value: number) => void;
  pass: () => void;
  chooseTrump: (suit: Suit) => void;
  playCard: (cardId: string) => void;
  revealTrump: () => void;
  declareMarriage: () => void;
  passChallenge: () => void;
  double: () => void;
  redouble: () => void;
  nextRound: () => void;
  undo: () => void;
  leave: () => void;

  connectOnline: () => Promise<Socket>;
  createRoom: (name: string) => Promise<void>;
  joinRoom: (code: string, name: string, spectator?: boolean) => Promise<void>;
  send: (msg: ClientMessage) => void;
  sendChat: (text: string) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ensure React has committed the latest snapshot before we continue. */
function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') {
      setTimeout(resolve, 32);
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function makeLocalEngine(level: AiLevel): GameEngine {
  const players = [
    createPlayer({ id: 'n', name: 'North', seat: Seat.North, kind: 'ai', aiLevel: level }),
    createPlayer({ id: 'e', name: 'East', seat: Seat.East, kind: 'ai', aiLevel: level }),
    createPlayer({ id: 's', name: 'You', seat: Seat.South, kind: 'human' }),
    createPlayer({ id: 'w', name: 'West', seat: Seat.West, kind: 'ai', aiLevel: level }),
  ];
  return new GameEngine(players, { allowDouble: true });
}

function currentActor(engine: GameEngine): Seat | null {
  const st = engine.getState();
  if (st.phase === GamePhase.Bidding) return st.auction.toAct;
  if (st.phase === GamePhase.TrumpSelection) return st.contractBidder;
  if (st.phase === GamePhase.Challenge) return st.toAct;
  if (st.phase === GamePhase.Playing) return st.toAct;
  return null;
}

function delayForPhase(phase: GamePhase, justFinishedTrick: boolean): number {
  if (justFinishedTrick) return AI_DELAY.afterTrick;
  switch (phase) {
    case GamePhase.Bidding:
      return AI_DELAY.bid;
    case GamePhase.TrumpSelection:
      return AI_DELAY.trump;
    case GamePhase.Challenge:
      return AI_DELAY.challenge;
    case GamePhase.Playing:
      return AI_DELAY.play;
    default:
      return AI_DELAY.bid;
  }
}

let aiGeneration = 0;

async function advanceAiAnimated(
  engine: GameEngine,
  refresh: () => void,
  setThinking: (v: boolean) => void,
): Promise<void> {
  const gen = ++aiGeneration;
  setThinking(true);
  try {
    for (let i = 0; i < 300; i++) {
      if (gen !== aiGeneration) return;

      const st = engine.getState();
      if (st.phase === GamePhase.Finished || st.phase === GamePhase.RoundEnd) return;

      const actor = currentActor(engine);
      if (!actor || actor === Seat.South) {
        return;
      }

      // 1) Think / pause BEFORE the action so the previous throw stays on screen
      const preDelay = delayForPhase(st.phase, false);
      await sleep(preDelay);
      if (gen !== aiGeneration) return;
      if (getEngineActorStillAi(engine, actor) === false) return;

      const tricksBefore = engine.getState().tricks.length;
      const playsBefore = engine.getState().currentTrick?.plays.length ?? 0;
      const phaseBefore = engine.getState().phase;
      const acting = currentActor(engine);
      if (!acting || acting === Seat.South) return;

      const level = engine.getState().players[acting].aiLevel ?? 'medium';
      try {
        applyAiDecision(engine, acting, decide(level, engine, acting));
      } catch {
        return;
      }

      // 2) Push state to UI and wait for paint so the new card mounts
      refresh();
      await waitForPaint();
      if (gen !== aiGeneration) return;

      const after = engine.getState();
      const trickDone = after.tricks.length > tricksBefore;
      const cardPlayed =
        phaseBefore === GamePhase.Playing &&
        (trickDone || (after.currentTrick?.plays.length ?? 0) > playsBefore);

      // 3) Watch the throw / trick result before the next seat acts
      if (trickDone) {
        await sleep(AI_DELAY.afterTrick);
      } else if (cardPlayed) {
        await sleep(AI_DELAY.throwWatch);
      } else if (phaseBefore === GamePhase.Bidding) {
        await sleep(350);
      } else {
        await sleep(500);
      }

      if (gen !== aiGeneration) return;
    }
  } finally {
    if (gen === aiGeneration) setThinking(false);
  }
}

function getEngineActorStillAi(engine: GameEngine, expected: Seat): boolean {
  const now = currentActor(engine);
  return now === expected;
}

function persistSession(playerId: string, code: string): void {
  try {
    localStorage.setItem('tn_session', JSON.stringify({ playerId, code }));
  } catch {
    /* ignore */
  }
}

function loadSession(): { playerId: string; code: string } | null {
  try {
    const raw = localStorage.getItem('tn_session');
    return raw ? (JSON.parse(raw) as { playerId: string; code: string }) : null;
  } catch {
    return null;
  }
}

function clearSession(): void {
  try {
    localStorage.removeItem('tn_session');
  } catch {
    /* ignore */
  }
}

function kickAi(get: () => GameStore, set: (p: Partial<GameStore>) => void): void {
  const { engine, mode } = get();
  if (!engine || mode !== 'local') return;
  // Cancel any in-flight loop, then start a fresh paced one
  void advanceAiAnimated(
    engine,
    () => {
      if (get().engine !== engine) return;
      set({ snapshot: serializeState(engine.getState()), events: [...get().events] });
    },
    (v) => {
      if (get().engine === engine) set({ aiThinking: v });
    },
  );
}

export const useGameStore = create<GameStore>((set, get) => ({
  mode: 'local',
  engine: null,
  snapshot: null,
  you: Seat.South,
  events: [],
  dark: true,
  socket: null,
  connected: false,
  room: null,
  playerId: null,
  chat: [],
  error: null,
  aiLevel: 'medium',
  toast: null,
  aiThinking: false,
  pendingPlay: null,

  setDark: (v) => {
    document.documentElement.classList.toggle('dark', v);
    set({ dark: v });
  },
  setAiLevel: (l) => set({ aiLevel: l }),
  clearError: () => set({ error: null }),

  startLocal: (level) => {
    aiGeneration++; // cancel any prior AI loop
    // Tear down any online session so Play again / local start can't bleed socket state
    const { socket } = get();
    if (socket) {
      try {
        socket.removeAllListeners();
        socket.disconnect();
      } catch {
        /* ignore */
      }
    }
    clearSession();
    const lv = level ?? get().aiLevel;
    const engine = makeLocalEngine(lv);
    const events: GameEvent[] = [];
    engine.subscribe((e) => {
      events.push(e);
      set({ events: [...events] });
      if (events.length > 100) events.shift();
    });
    engine.startRound();
    set({
      mode: 'local',
      engine,
      snapshot: serializeState(engine.getState()),
      you: Seat.South,
      events: [...events],
      error: null,
      room: null,
      playerId: null,
      socket: null,
      connected: false,
      chat: [],
      aiThinking: false,
      pendingPlay: null,
    });
    kickAi(get, set);
  },

  refresh: () => {
    const { engine } = get();
    if (!engine) return;
    set({ snapshot: serializeState(engine.getState()) });
  },

  bid: (value) => {
    const { mode, engine, send } = get();
    if (mode === 'online') {
      send({ type: 'Bid', value });
      return;
    }
    engine?.bid(Seat.South, value);
    get().refresh();
    kickAi(get, set);
  },
  pass: () => {
    const { mode, engine, send } = get();
    if (mode === 'online') {
      send({ type: 'Pass' });
      return;
    }
    engine?.pass(Seat.South);
    get().refresh();
    kickAi(get, set);
  },
  chooseTrump: (suit) => {
    const { mode, engine, send } = get();
    if (mode === 'online') {
      send({ type: 'ChooseTrump', suit });
      return;
    }
    engine?.chooseTrump(Seat.South, suit);
    get().refresh();
    kickAi(get, set);
  },
  playCard: (cardId) => {
    const { mode, engine, send, pendingPlay } = get();
    if (mode === 'online') {
      if (pendingPlay) return;
      set({ pendingPlay: cardId });
      send({ type: 'PlayCard', cardId });
      return;
    }
    if (!engine) return;
    const tricksBefore = engine.getState().tricks.length;
    engine.playCard(Seat.South, cardId);
    get().refresh();
    const trickDone = engine.getState().tricks.length > tricksBefore;
    const delay = trickDone ? AI_DELAY.afterTrick : AI_DELAY.throwWatch;
    window.setTimeout(() => {
      if (get().engine === engine) kickAi(get, set);
    }, delay);
  },
  revealTrump: () => {
    const { mode, engine, send } = get();
    if (mode === 'online') {
      send({ type: 'RevealTrump' });
      return;
    }
    engine?.revealTrump(Seat.South, 'voluntary');
    get().refresh();
  },
  declareMarriage: () => {
    const { mode, engine, send } = get();
    if (mode === 'online') {
      send({ type: 'DeclareMarriage' });
      return;
    }
    engine?.declareMarriage(Seat.South);
    get().refresh();
  },
  passChallenge: () => {
    const { mode, engine, send } = get();
    if (mode === 'online') {
      send({ type: 'PassChallenge' });
      return;
    }
    engine?.passChallenge(Seat.South);
    get().refresh();
    kickAi(get, set);
  },
  double: () => {
    const { mode, engine, send } = get();
    if (mode === 'online') {
      send({ type: 'Double' });
      return;
    }
    engine?.double(Seat.South);
    get().refresh();
    kickAi(get, set);
  },
  redouble: () => {
    const { mode, engine, send } = get();
    if (mode === 'online') {
      send({ type: 'Redouble' });
      return;
    }
    engine?.redouble(Seat.South);
    get().refresh();
    kickAi(get, set);
  },
  nextRound: () => {
    const { mode, engine, send } = get();
    if (mode === 'online') {
      send({ type: 'NextRound' });
      return;
    }
    aiGeneration++;
    engine?.startRound();
    get().refresh();
    kickAi(get, set);
  },
  undo: () => {
    aiGeneration++;
    get().engine?.undo();
    set({ aiThinking: false });
    get().refresh();
    kickAi(get, set);
  },

  leave: () => {
    aiGeneration++;
    const { mode, send, socket } = get();
    if (mode === 'online') {
      send({ type: 'LeaveRoom' });
      socket?.disconnect();
    }
    clearSession();
    set({
      snapshot: null,
      engine: null,
      room: null,
      playerId: null,
      socket: null,
      connected: false,
      chat: [],
      mode: 'local',
      error: null,
      aiThinking: false,
      pendingPlay: null,
    });
  },

  connectOnline: () => {
    const existing = get().socket;
    if (existing?.connected) return Promise.resolve(existing);

    return new Promise<Socket>((resolve, reject) => {
      if (existing) {
        existing.removeAllListeners();
        existing.disconnect();
      }

      const socket = io(SOCKET_URL || undefined, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });

      const onConnect = () => {
        set({ connected: true });
        const session = loadSession();
        if (session && !get().room) {
          socket.emit('message', {
            type: 'Reconnect',
            playerId: session.playerId,
            code: session.code,
          } satisfies ClientMessage);
        }
        resolve(socket);
      };

      socket.on('connect', onConnect);
      socket.on('disconnect', () => set({ connected: false }));
      socket.on('connect_error', (err) => {
        set({ error: `Connection failed: ${err.message}`, connected: false });
        reject(err);
      });

      socket.on('message', (msg: ServerMessage) => {
        const patch: Partial<GameStore> = {};
        switch (msg.type) {
          case 'RoomCreated':
            patch.room = msg.room;
            patch.playerId = msg.playerId;
            patch.mode = 'online';
            persistSession(msg.playerId, msg.room.code);
            break;
          case 'ReconnectOk':
            patch.room = msg.room;
            patch.playerId = msg.playerId;
            patch.mode = 'online';
            patch.engine = null;
            patch.pendingPlay = null;
            if (msg.state) patch.snapshot = msg.state;
            persistSession(msg.playerId, msg.room.code);
            break;
          case 'RoomUpdated':
            patch.room = msg.room;
            break;
          case 'PlayerJoined':
            patch.toast = `${msg.player.name} joined`;
            break;
          case 'PlayerLeft': {
            patch.toast = 'A player disconnected';
            const room = get().room;
            if (room) {
              patch.room = {
                ...room,
                players: room.players.map((p) =>
                  p.id === msg.playerId ? { ...p, connected: false } : p,
                ),
                spectators: room.spectators.map((p) =>
                  p.id === msg.playerId ? { ...p, connected: false } : p,
                ),
              };
            }
            break;
          }
          case 'GameState':
          case 'SyncState':
            patch.snapshot = msg.state;
            if (msg.you) patch.you = msg.you;
            patch.mode = 'online';
            patch.engine = null; // never keep a local engine over online state
            patch.pendingPlay = null;
            break;
          case 'RoundEnd':
            patch.toast = msg.summary;
            patch.pendingPlay = null;
            break;
          case 'GameFinished':
            patch.toast = `Match over — winner ${msg.winner}`;
            patch.pendingPlay = null;
            break;
          case 'ChatMessage':
            patch.chat = [
              ...get().chat,
              { name: msg.name, text: msg.text, at: msg.at, playerId: msg.playerId },
            ];
            break;
          case 'Error':
            patch.error = msg.message;
            patch.pendingPlay = null;
            break;
          default:
            break;
        }
        set(patch);
        if (patch.toast) {
          setTimeout(() => {
            if (get().toast === patch.toast) set({ toast: null });
          }, 2800);
        }
      });

      set({ socket, connected: false });
      if (socket.connected) onConnect();
    });
  },

  createRoom: async (name) => {
    try {
      const socket = await get().connectOnline();
      socket.emit('message', { type: 'CreateRoom', name } satisfies ClientMessage);
    } catch {
      set({ error: 'Could not reach game server. Is it running?' });
    }
  },
  joinRoom: async (code, name, spectator) => {
    try {
      const socket = await get().connectOnline();
      socket.emit('message', {
        type: 'JoinRoom',
        code: code.toUpperCase().trim(),
        name,
        asSpectator: spectator,
      } satisfies ClientMessage);
    } catch {
      set({ error: 'Could not reach game server. Is it running?' });
    }
  },
  send: (msg) => {
    const socket = get().socket;
    if (!socket?.connected) {
      set({ error: 'Not connected to server' });
      return;
    }
    socket.emit('message', msg);
  },
  sendChat: (text) => {
    get().send({ type: 'Chat', text });
  },
}));
