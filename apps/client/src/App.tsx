import { useGameStore } from './store/gameStore';
import { Lobby } from './components/Lobby';
import { GameTable } from './components/GameTable';
import { BidDialog } from './components/BidDialog';
import { Scoreboard } from './components/Scoreboard';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function App() {
  const snapshot = useGameStore((s) => s.snapshot);
  const room = useGameStore((s) => s.room);
  const mode = useGameStore((s) => s.mode);
  const error = useGameStore((s) => s.error);
  const toast = useGameStore((s) => s.toast);
  const connected = useGameStore((s) => s.connected);
  const aiThinking = useGameStore((s) => s.aiThinking);
  const undo = useGameStore((s) => s.undo);
  const leave = useGameStore((s) => s.leave);
  const clearError = useGameStore((s) => s.clearError);
  const chat = useGameStore((s) => s.chat);
  const sendChat = useGameStore((s) => s.sendChat);
  const [chatText, setChatText] = useState('');
  const [showSide, setShowSide] = useState(false);

  const inGame = Boolean(snapshot);
  const inLobbyRoom = Boolean(room) && !inGame;

  return (
    <div className="h-dvh max-h-dvh flex flex-col relative overflow-hidden">
      <div className="ambient-orbs" aria-hidden />

      <nav className="relative z-20 flex items-center justify-between px-3 py-1.5 text-cream shrink-0">
        <div className="font-display text-lg tracking-wide flex items-center gap-2">
          <span className="text-gold">♠</span> Twenty-Nine
          <span className="text-[10px] uppercase tracking-wider opacity-50 font-body px-2 py-0.5 rounded-full bg-white/10">
            {mode}
            {mode === 'online' && (connected ? ' · live' : ' · …')}
            {aiThinking && ' · AI'}
          </span>
        </div>
        <div className="flex gap-1.5">
          {inGame && (
            <button
              type="button"
              onClick={() => setShowSide((v) => !v)}
              className="text-xs px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 xl:hidden"
            >
              {showSide ? 'Table' : 'Score'}
            </button>
          )}
          {inGame && mode === 'local' && (
            <button
              type="button"
              onClick={() => undo()}
              className="text-xs px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20"
            >
              Undo
            </button>
          )}
          {(inGame || inLobbyRoom) && (
            <button
              type="button"
              onClick={() => leave()}
              className="text-xs px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20"
            >
              Leave
            </button>
          )}
        </div>
      </nav>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative z-20 mx-3 mb-1 px-3 py-1.5 bg-danger/85 text-cream text-sm rounded-xl flex justify-between gap-3 shrink-0"
            role="alert"
          >
            <span>{error}</span>
            <button type="button" onClick={() => clearError()} className="underline text-xs">
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-ink/90 text-cream text-sm shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {!inGame && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Lobby />
        </div>
      )}

      {inGame && (
        <main className="relative z-10 flex-1 min-h-0 flex gap-2 px-2 pb-2">
          <motion.div
            className={`min-h-0 min-w-0 ${showSide ? 'hidden' : 'flex'} xl:flex flex-1`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <GameTable />
          </motion.div>

          <div
            className={`min-h-0 overflow-y-auto ${
              showSide ? 'flex' : 'hidden'
            } xl:flex w-full xl:w-64 shrink-0 flex-col gap-2`}
          >
            <Scoreboard />
            {mode === 'online' && (
              <div className="bg-black/30 backdrop-blur rounded-2xl p-3 text-cream border border-white/10">
                <div className="text-xs font-semibold mb-2 tracking-wide uppercase opacity-80">
                  Chat
                </div>
                <ul className="max-h-28 overflow-y-auto text-xs space-y-1 mb-2">
                  {chat.length === 0 && <li className="opacity-40">Say hello…</li>}
                  {chat.map((c, i) => (
                    <li key={`${c.at}-${i}`}>
                      <strong className="text-gold-soft">{c.name}</strong>: {c.text}
                    </li>
                  ))}
                </ul>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!chatText.trim()) return;
                    sendChat(chatText.trim());
                    setChatText('');
                  }}
                  className="flex gap-2"
                >
                  <input
                    className="flex-1 rounded-xl bg-cream text-ink px-2 py-1 text-sm"
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    aria-label="Chat message"
                    placeholder="Message"
                  />
                  <button type="submit" className="text-xs px-2 bg-gold text-ink rounded-xl font-bold">
                    Send
                  </button>
                </form>
              </div>
            )}
          </div>

          <BidDialog />
        </main>
      )}
    </div>
  );
}
