import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';

export function ChatPanel() {
  const chat = useGameStore((s) => s.chat);
  const sendChat = useGameStore((s) => s.sendChat);
  const playerId = useGameStore((s) => s.playerId);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  return (
    <div className="side-panel text-cream flex flex-col min-h-0 flex-1">
      <div className="px-3 pt-3 pb-2 text-[10px] font-semibold tracking-[0.18em] uppercase opacity-60">
        Chat
      </div>

      <ul
        ref={listRef}
        className="flex-1 min-h-[7.5rem] max-h-40 overflow-y-auto px-2.5 pb-2 flex flex-col gap-2"
        aria-live="polite"
      >
        {chat.length === 0 && (
          <li className="text-xs opacity-40 px-1 py-2 text-center">Say hello…</li>
        )}
        {chat.map((c, i) => {
          const mine = Boolean(playerId && c.playerId && c.playerId === playerId);
          return (
            <li
              key={`${c.at}-${i}`}
              className={`flex flex-col max-w-[88%] ${mine ? 'self-end items-end' : 'self-start items-start'}`}
            >
              {!mine && (
                <span className="text-[10px] text-gold-soft/90 mb-0.5 px-1 font-semibold truncate max-w-full">
                  {c.name}
                </span>
              )}
              <div
                className={`px-2.5 py-1.5 shadow-sm break-words ${
                  mine
                    ? 'bg-gold text-ink rounded-2xl rounded-br-md text-[13px] leading-snug'
                    : 'bg-cream/95 text-ink rounded-2xl rounded-bl-md text-xs leading-snug'
                }`}
              >
                {c.text}
              </div>
              <span className="text-[9px] opacity-40 mt-0.5 px-1 tabular-nums">
                {formatTime(c.at)}
              </span>
            </li>
          );
        })}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          sendChat(text.trim());
          setText('');
        }}
        className="flex gap-2 p-2.5 border-t border-white/10"
      >
        <input
          className="flex-1 min-w-0 rounded-xl bg-cream text-ink px-2.5 py-1.5 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Chat message"
          placeholder="Message"
          maxLength={200}
        />
        <button
          type="submit"
          className="shrink-0 text-xs px-3 py-1.5 bg-gold text-ink rounded-xl font-bold hover:brightness-105"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function formatTime(at: number): string {
  try {
    return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
