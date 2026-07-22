import { useGameStore } from '../store/gameStore';
import { useState } from 'react';

export function Scoreboard() {
  const snapshot = useGameStore((s) => s.snapshot);
  const events = useGameStore((s) => s.events);
  const [tab, setTab] = useState<'score' | 'history' | 'tricks'>('score');

  if (!snapshot) return null;

  return (
    <aside className="bg-black/30 backdrop-blur text-cream rounded-xl p-3 w-full border border-white/10">
      <div className="flex gap-1.5 mb-2 text-xs">
        {(['score', 'history', 'tricks'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-2.5 py-1 rounded-full capitalize ${
              tab === t ? 'bg-gold text-ink' : 'bg-white/10'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'score' && (
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between font-display text-base">
            <span>NS</span>
            <span className="text-gold">{snapshot.scoreboard.ns}</span>
          </div>
          <div className="flex justify-between font-display text-base">
            <span>EW</span>
            <span className="text-gold">{snapshot.scoreboard.ew}</span>
          </div>
          <div className="text-[11px] opacity-70 pt-1.5 border-t border-white/10">
            Round NS {snapshot.pointsNS} · EW {snapshot.pointsEW}
            {snapshot.contractBid != null && (
              <div>
                Bid {snapshot.contractBid} ({snapshot.contractBidder})
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <ul className="max-h-40 overflow-y-auto text-[11px] space-y-1">
          {snapshot.scoreboard.roundHistory.map((r, i) => (
            <li key={i}>
              R{i + 1}: {r.bidValue} → {r.bidMade ? 'made' : 'set'} (
              {r.gamePointDelta > 0 ? '+' : ''}
              {r.gamePointDelta})
            </li>
          ))}
          {events.slice(-8).reverse().map((e, i) => (
            <li key={i} className="opacity-60">
              {e.type}
            </li>
          ))}
        </ul>
      )}

      {tab === 'tricks' && (
        <ul className="max-h-40 overflow-y-auto text-[11px] space-y-1.5">
          {snapshot.tricks.map((t) => (
            <li key={t.index}>
              <div className="font-semibold">
                T{t.index + 1} {t.winner} (+{t.cardPoints})
              </div>
              <div className="opacity-70">
                {t.plays.map((p) => `${p.seat}:${p.card.rank}${p.card.suit}`).join(' ')}
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
