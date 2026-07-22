import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { ALL_SEATS, seatDisplayName, type AiLevel } from '@twenty-nine/core';

export function Lobby() {
  const startLocal = useGameStore((s) => s.startLocal);
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const send = useGameStore((s) => s.send);
  const leave = useGameStore((s) => s.leave);
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const connected = useGameStore((s) => s.connected);
  const aiLevel = useGameStore((s) => s.aiLevel);
  const setAiLevel = useGameStore((s) => s.setAiLevel);
  const [name, setName] = useState(() => localStorage.getItem('tn_name') || 'Player');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  const saveName = (n: string) => {
    setName(n);
    localStorage.setItem('tn_name', n);
  };

  if (room) {
    const isHost = playerId === room.hostId;
    const mySeat = room.players.find((p) => p.id === playerId)?.seat;

    return (
      <motion.div
        className="max-w-2xl mx-auto px-4 pb-10"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="bg-cream/95 text-ink rounded-3xl p-6 md:p-8 shadow-2xl border border-gold/30">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-felt">Multiplayer room</p>
              <h2 className="font-display text-4xl mt-1">
                {room.code}
                <button
                  type="button"
                  className="ml-3 text-sm font-body font-semibold text-felt underline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(room.code);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </h2>
              <p className="text-sm opacity-70 mt-1">
                Share the code · {connected ? 'Connected' : 'Reconnecting…'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => leave()}
              className="text-sm px-3 py-1.5 rounded-lg border border-ink/15 hover:bg-ink/5"
            >
              Leave
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {ALL_SEATS.map((seat) => {
              const occupant = room.players.find((p) => p.seat === seat);
              const empty = !occupant;
              return (
                <motion.div
                  key={seat}
                  layout
                  className={`rounded-2xl border p-4 ${
                    mySeat === seat
                      ? 'border-gold bg-gold/15'
                      : empty
                        ? 'border-dashed border-ink/20 bg-white/40'
                        : 'border-ink/10 bg-white/70'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-display text-lg">{seatDisplayName(seat)}</span>
                    <span className="text-xs opacity-50">{seat}</span>
                  </div>
                  {occupant ? (
                    <div className="text-sm">
                      <div className="font-semibold">
                        {occupant.name}
                        {occupant.id === room.hostId && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide bg-felt text-cream px-1.5 py-0.5 rounded">
                            Host
                          </span>
                        )}
                      </div>
                      <div className="opacity-60 text-xs mt-0.5">
                        {occupant.kind === 'ai' ? `AI · ${occupant.aiLevel}` : occupant.connected ? 'Online' : 'Offline'}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        disabled={Boolean(mySeat)}
                        onClick={() => send({ type: 'Sit', seat })}
                        className="text-sm py-2 rounded-lg bg-felt text-cream font-semibold disabled:opacity-40"
                      >
                        Sit here
                      </button>
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => send({ type: 'SetAi', seat, level: aiLevel })}
                          className="text-xs py-1.5 rounded-lg border border-ink/15"
                        >
                          Fill with AI
                        </button>
                      )}
                    </div>
                  )}
                  {isHost && occupant?.kind === 'ai' && (
                    <button
                      type="button"
                      onClick={() => send({ type: 'SetAi', seat, level: aiLevel })}
                      className="mt-2 text-xs underline opacity-60"
                    >
                      Change AI ({aiLevel})
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>

          {room.spectators.length > 0 && (
            <p className="text-xs opacity-60 mb-4">
              Spectators: {room.spectators.map((s) => s.name).join(', ')}
            </p>
          )}

          {isHost ? (
            <button
              type="button"
              onClick={() => send({ type: 'StartGame' })}
              className="w-full py-3.5 rounded-2xl bg-gold text-ink font-bold text-lg shadow-lg hover:brightness-105 transition"
            >
              Start match
              <span className="block text-xs font-normal opacity-70 mt-0.5">
                Empty seats become AI
              </span>
            </button>
          ) : (
            <p className="text-center text-sm opacity-70 py-3">Waiting for host to start…</p>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-xl mx-auto text-cream px-4 pb-16">
      <motion.header
        className="text-center mb-10 pt-6 md:pt-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.p
          className="text-gold-soft tracking-[0.35em] text-xs uppercase mb-3"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          South Asian classic
        </motion.p>
        <h1 className="font-display text-6xl md:text-8xl text-cream drop-shadow-lg">Twenty-Nine</h1>
        <p className="mt-4 text-cream/80 max-w-md mx-auto text-base md:text-lg leading-relaxed">
          Hidden trump. Marriage. Last trick. Play local vs AI or open a room for friends.
        </p>
      </motion.header>

      <div className="grid gap-4">
        <motion.section
          className="lobby-panel"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="font-display text-2xl mb-3">Play vs AI</h2>
          <label className="block text-sm mb-3 opacity-90">
            Difficulty
            <select
              className="mt-1.5 w-full rounded-xl bg-cream text-ink px-3 py-2.5 font-semibold"
              value={aiLevel}
              onChange={(e) => setAiLevel(e.target.value as AiLevel)}
            >
              <option value="easy">Easy — random legal</option>
              <option value="medium">Medium — heuristics</option>
              <option value="hard">Hard — counting</option>
            </select>
          </label>
          <button
            type="button"
            data-testid="start-local"
            onClick={() => startLocal()}
            className="w-full py-3.5 rounded-2xl bg-gold text-ink font-bold text-lg shadow-lg hover:brightness-105 transition"
          >
            Start local match
          </button>
        </motion.section>

        <motion.section
          className="lobby-panel"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="font-display text-2xl mb-3">Multiplayer</h2>
          <input
            className="w-full mb-3 rounded-xl bg-cream text-ink px-3 py-2.5 font-semibold"
            value={name}
            onChange={(e) => saveName(e.target.value)}
            placeholder="Your name"
            aria-label="Your name"
          />
          <button
            type="button"
            onClick={() => void createRoom(name || 'Host')}
            className="w-full mb-4 py-3.5 rounded-2xl bg-felt-light text-cream font-bold hover:bg-felt transition"
          >
            Create room
          </button>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl bg-cream text-ink px-3 py-2.5 uppercase tracking-widest font-bold"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ROOM CODE"
              aria-label="Room code"
              maxLength={6}
            />
            <button
              type="button"
              onClick={() => void joinRoom(code, name || 'Guest')}
              className="px-5 rounded-xl bg-cream text-ink font-bold"
            >
              Join
            </button>
          </div>
          <button
            type="button"
            onClick={() => void joinRoom(code, name || 'Guest', true)}
            className="mt-3 w-full text-sm opacity-80 underline disabled:opacity-40"
            disabled={code.trim().length < 4}
          >
            Join as spectator
          </button>
        </motion.section>
      </div>
    </div>
  );
}
