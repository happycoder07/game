import { useGameStore } from '../store/gameStore';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Suit,
  suitSymbol,
  suitDisplayName,
  seatDisplayName,
  isRedSuit,
  teamForSeat,
  TeamId,
} from '@twenty-nine/core';

export function Scoreboard() {
  const snapshot = useGameStore((s) => s.snapshot);
  const events = useGameStore((s) => s.events);
  const [tab, setTab] = useState<'match' | 'history' | 'tricks'>('match');

  if (!snapshot) return null;

  const trump = snapshot.trump;
  const trumpSuit = trump.suit as Suit | null;
  const trumpRed = trumpSuit ? isRedSuit(trumpSuit) : false;
  const bidder = snapshot.contractBidder
    ? seatDisplayName(snapshot.contractBidder)
    : null;
  const bidTeam =
    snapshot.contractBidder != null ? teamForSeat(snapshot.contractBidder) : null;

  return (
    <aside className="side-panel text-cream w-full flex flex-col gap-3">
      {/* Trump */}
      <section className="px-3 pt-3 pb-2">
        <div className="text-[10px] uppercase tracking-[0.18em] opacity-55 mb-2">Trump</div>
        <div className="flex items-center gap-3">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-4xl shadow-inner ${
              trump.revealed && trumpSuit
                ? 'bg-cream'
                : 'bg-black/35 border border-dashed border-white/25'
            }`}
            style={
              trump.revealed && trumpSuit
                ? { color: trumpRed ? '#b33a3a' : '#1a1a14' }
                : undefined
            }
          >
            {trump.revealed && trumpSuit ? (
              <motion.span
                key={trumpSuit}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18 }}
              >
                {suitSymbol(trumpSuit)}
              </motion.span>
            ) : (
              <span className="text-lg text-cream/40">?</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg leading-tight">
              {trump.revealed && trumpSuit
                ? suitDisplayName(trumpSuit)
                : trumpSuit
                  ? 'Hidden'
                  : 'Not set'}
            </div>
            <div className="text-[11px] opacity-60 mt-0.5">
              {trump.revealed
                ? 'Revealed'
                : trumpSuit
                  ? 'Chosen — still hidden'
                  : 'Awaiting bid winner'}
            </div>
          </div>
        </div>
      </section>

      <div className="h-px bg-white/10 mx-3" />

      {/* Bid */}
      <section className="px-3">
        <div className="text-[10px] uppercase tracking-[0.18em] opacity-55 mb-1.5">Contract</div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="font-display text-3xl text-gold-soft tabular-nums leading-none">
              {snapshot.contractBid ?? '—'}
            </div>
            <div className="text-[11px] opacity-65 mt-1">
              {bidder ? (
                <>
                  {bidder}
                  {bidTeam != null && (
                    <span className="opacity-80"> · {bidTeam === TeamId.NS ? 'NS' : 'EW'}</span>
                  )}
                </>
              ) : (
                'No bid yet'
              )}
            </div>
          </div>
          {(snapshot.challenge.doubled || snapshot.challenge.redoubled) && (
            <div className="text-xs font-bold px-2 py-1 rounded-lg bg-danger/90 text-cream">
              {snapshot.challenge.redoubled ? '×4' : '×2'}
            </div>
          )}
        </div>
      </section>

      <div className="h-px bg-white/10 mx-3" />

      {/* Round card points */}
      <section className="px-3">
        <div className="text-[10px] uppercase tracking-[0.18em] opacity-55 mb-2">
          Round points
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TeamPoints label="NS" value={snapshot.pointsNS} accent="ns" />
          <TeamPoints label="EW" value={snapshot.pointsEW} accent="ew" />
        </div>
      </section>

      {/* Match score */}
      <section className="px-3 pb-1">
        <div className="text-[10px] uppercase tracking-[0.18em] opacity-55 mb-2">
          Match score
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TeamPoints label="NS" value={snapshot.scoreboard.ns} accent="ns" large />
          <TeamPoints label="EW" value={snapshot.scoreboard.ew} accent="ew" large />
        </div>
      </section>

      <div className="h-px bg-white/10 mx-3" />

      {/* Secondary tabs */}
      <div className="px-3 pb-3">
        <div className="flex gap-1 mb-2">
          {(['match', 'history', 'tricks'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wide ${
                tab === t ? 'bg-gold text-ink' : 'bg-white/10 hover:bg-white/15'
              }`}
            >
              {t === 'match' ? 'Phase' : t}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'match' && (
            <motion.div
              key="match"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs space-y-1 opacity-80"
            >
              <div>
                Phase: <strong className="text-gold-soft">{snapshot.phase}</strong>
              </div>
              <div>
                Round {snapshot.roundNumber}
                {snapshot.dealer != null && <> · Dealer {seatDisplayName(snapshot.dealer)}</>}
              </div>
              {snapshot.marriage.bidAdjustment !== 0 && (
                <div>Marriage adj. {snapshot.marriage.bidAdjustment}</div>
              )}
            </motion.div>
          )}

          {tab === 'history' && (
            <motion.ul
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-h-36 overflow-y-auto text-[11px] space-y-1 pr-1"
            >
              {snapshot.scoreboard.roundHistory.length === 0 && (
                <li className="opacity-40">No rounds yet</li>
              )}
              {snapshot.scoreboard.roundHistory.map((r, i) => (
                <li key={i}>
                  R{i + 1}: bid {r.bidValue} → {r.bidMade ? 'made' : 'set'} (
                  {r.gamePointDelta > 0 ? '+' : ''}
                  {r.gamePointDelta})
                </li>
              ))}
              {events.slice(-6).reverse().map((e, i) => (
                <li key={`e-${i}`} className="opacity-50">
                  {e.type}
                </li>
              ))}
            </motion.ul>
          )}

          {tab === 'tricks' && (
            <motion.ul
              key="tricks"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-h-36 overflow-y-auto text-[11px] space-y-1.5 pr-1"
            >
              {snapshot.tricks.length === 0 && <li className="opacity-40">No tricks yet</li>}
              {snapshot.tricks.map((t) => (
                <li key={t.index}>
                  <div className="font-semibold">
                    Hand {t.index + 1} · {t.winner ? seatDisplayName(t.winner) : '—'} (+
                    {t.cardPoints})
                  </div>
                  <div className="opacity-60">
                    {t.plays.map((p) => `${p.seat[0]}${p.card.rank}${p.card.suit}`).join(' ')}
                  </div>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}

function TeamPoints({
  label,
  value,
  accent,
  large,
}: {
  label: string;
  value: number;
  accent: 'ns' | 'ew';
  large?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-2.5 py-2 border ${
        accent === 'ns' ? 'border-gold/25 bg-gold/10' : 'border-white/15 bg-white/5'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider opacity-60">{label}</div>
      <div
        className={`font-display tabular-nums text-gold-soft ${
          large ? 'text-2xl' : 'text-xl'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
