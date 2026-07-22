import { useGameStore } from './store/gameStore';
import { Lobby } from './components/Lobby';
import { GameTable } from './components/GameTable';
import { BidDialog } from './components/BidDialog';
import { Scoreboard } from './components/Scoreboard';
import { ChatPanel } from './components/ChatPanel';
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
        <div className="flex items-center gap-1.5">
          {inGame && (
            <button
              type="button"
              onClick={() => setShowSide((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 xl:hidden"
              aria-label={showSide ? 'Show table' : 'Show score'}
              title={showSide ? 'Table' : 'Score'}
            >
              {showSide ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden className="opacity-90">
                  <ellipse cx="12" cy="12" rx="9" ry="6" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M3 12h18" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden className="opacity-90">
                  <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              )}
              <span>{showSide ? 'Table' : 'Score'}</span>
            </button>
          )}
          {inGame && mode === 'local' && (
            <button
              type="button"
              onClick={() => undo()}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-cream"
              aria-label="Undo"
              title="Undo"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M9.5 7.5 6 11l3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6 11h8.5a4.5 4.5 0 1 1 0 9H12"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          {(inGame || inLobbyRoom) && (
            <button
              type="button"
              onClick={() => leave()}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-cream hover:text-danger"
              aria-label="Leave"
              title="Leave"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M10 7V5.8A1.8 1.8 0 0 1 11.8 4h6.4A1.8 1.8 0 0 1 20 5.8v12.4a1.8 1.8 0 0 1-1.8 1.8h-6.4A1.8 1.8 0 0 1 10 18.2V17"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
                <path
                  d="M13 12H4m0 0 2.8-2.8M4 12l2.8 2.8"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
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
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 px-2 pb-2">
          <Lobby />
          {mode === 'online' && room && (
            <div className="max-w-md mx-auto w-full">
              <ChatPanel />
            </div>
          )}
        </div>
      )}

      {inGame && (
        <main className="relative z-10 flex-1 min-h-0 flex gap-2 px-2 pb-2 overflow-visible">
          <motion.div
            className={`min-h-0 min-w-0 overflow-visible ${showSide ? 'hidden' : 'flex'} xl:flex flex-1`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <GameTable />
          </motion.div>

          <div
            className={`min-h-0 overflow-y-auto ${
              showSide ? 'flex' : 'hidden'
            } xl:flex w-full xl:w-72 shrink-0 flex-col gap-2`}
          >
            <Scoreboard />
            {mode === 'online' && <ChatPanel />}
          </div>

          <BidDialog />
        </main>
      )}
    </div>
  );
}
