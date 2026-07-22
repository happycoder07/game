import { motion, AnimatePresence } from 'framer-motion';
import {
  Seat,
  GamePhase,
  suitSymbol,
  suitDisplayName,
  seatDisplayName,
  ALL_SEATS,
  type Suit,
  type Rank,
  Card,
  type TrickJSON,
} from '@twenty-nine/core';
import { PlayingCard } from './PlayingCard';
import { useGameStore } from '../store/gameStore';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { legalMovesFromSnapshot } from '../lib/legalFromSnapshot';
import { AI_DELAY } from '../store/gameStore';

function relativeSeat(absolute: Seat, you: Seat): Seat {
  const order = [Seat.North, Seat.East, Seat.South, Seat.West];
  const youIdx = order.indexOf(you);
  const absIdx = order.indexOf(absolute);
  const rel = (absIdx - youIdx + 2 + 4) % 4;
  return order[rel]!;
}

const SEAT_POS: Record<Seat, string> = {
  [Seat.North]: 'top-2 left-1/2 -translate-x-1/2',
  [Seat.East]: 'right-2 top-[38%] -translate-y-1/2',
  [Seat.South]: 'bottom-2 left-1/2 -translate-x-1/2',
  [Seat.West]: 'left-2 top-[38%] -translate-y-1/2',
};

const TRICK_POS: Record<Seat, string> = {
  [Seat.North]: 'top-[30%] left-1/2 -translate-x-1/2',
  [Seat.East]: 'right-[30%] top-[46%] -translate-y-1/2',
  [Seat.South]: 'bottom-[34%] left-1/2 -translate-x-1/2',
  [Seat.West]: 'left-[30%] top-[46%] -translate-y-1/2',
};

/** Flight path from seat edge toward center (inside the felt, not clipped away). */
const TRICK_ORIGIN: Record<Seat, { x: number; y: number }> = {
  [Seat.North]: { x: 0, y: -90 },
  [Seat.East]: { x: 110, y: 0 },
  [Seat.South]: { x: 0, y: 100 },
  [Seat.West]: { x: -110, y: 0 },
};

interface FlyingCard {
  id: string;
  suit: Suit;
  rank: Rank;
  fromX: number;
  fromY: number;
}

export function GameTable() {
  const snapshot = useGameStore((s) => s.snapshot);
  const engine = useGameStore((s) => s.engine);
  const room = useGameStore((s) => s.room);
  const you = useGameStore((s) => s.you);
  const aiThinking = useGameStore((s) => s.aiThinking);
  const playCard = useGameStore((s) => s.playCard);
  const revealTrump = useGameStore((s) => s.revealTrump);
  const declareMarriage = useGameStore((s) => s.declareMarriage);

  const tableRef = useRef<HTMLDivElement>(null);
  const handRefs = useRef<Map<string, HTMLElement>>(new Map());

  const [selected, setSelected] = useState<string | null>(null);
  const [lastTrickWinner, setLastTrickWinner] = useState<Seat | null>(null);
  const [trumpFlash, setTrumpFlash] = useState(false);
  const [dealKey, setDealKey] = useState(0);
  const [heldTrick, setHeldTrick] = useState<TrickJSON | null>(null);
  const [flying, setFlying] = useState<FlyingCard | null>(null);
  const [hiddenInHand, setHiddenInHand] = useState<string | null>(null);
  const prevTrickCount = useRef(0);
  const throwLock = useRef(false);

  const legal = useMemo(() => {
    if (!snapshot || flying) return [] as string[];
    if (engine) {
      if (snapshot.phase !== GamePhase.Playing || snapshot.toAct !== you) return [];
      return engine.getLegalMoves(you);
    }
    return legalMovesFromSnapshot(snapshot, you);
  }, [engine, snapshot, you, flying]);

  useEffect(() => {
    if (!snapshot) return;
    const count = snapshot.tricks.length;
    if (count > prevTrickCount.current) {
      const last = snapshot.tricks[count - 1]!;
      setHeldTrick(last);
      setLastTrickWinner(last.winner ?? null);
      const t = setTimeout(() => {
        setHeldTrick(null);
        setLastTrickWinner(null);
      }, AI_DELAY.afterTrick);
      prevTrickCount.current = count;
      return () => clearTimeout(t);
    }
    prevTrickCount.current = count;
  }, [snapshot?.tricks.length, snapshot]);

  useEffect(() => {
    if (snapshot?.trump.revealed) {
      setTrumpFlash(true);
      const t = setTimeout(() => setTrumpFlash(false), 1400);
      return () => clearTimeout(t);
    }
  }, [snapshot?.trump.revealed, snapshot?.trump.suit]);

  useEffect(() => {
    setDealKey((k) => k + 1);
    prevTrickCount.current = 0;
    setHeldTrick(null);
    setFlying(null);
    setHiddenInHand(null);
    throwLock.current = false;
  }, [snapshot?.roundNumber]);

  const onPlay = useCallback(
    (cardId: string) => {
      if (!legal.includes(cardId) || throwLock.current || flying) return;
      const card = Card.fromId(cardId);
      const table = tableRef.current;
      const el = handRefs.current.get(cardId);
      if (!table || !el) {
        playCard(cardId);
        setSelected(null);
        return;
      }

      throwLock.current = true;
      const tableBox = table.getBoundingClientRect();
      const cardBox = el.getBoundingClientRect();
      const fromX = cardBox.left + cardBox.width / 2 - (tableBox.left + tableBox.width / 2);
      const fromY = cardBox.top + cardBox.height / 2 - (tableBox.top + tableBox.height * 0.55);

      setHiddenInHand(cardId);
      setFlying({
        id: cardId,
        suit: card.suit,
        rank: card.rank,
        fromX,
        fromY,
      });
      setSelected(null);

      // Commit engine mid-flight so trick state is ready when fly ends
      window.setTimeout(() => {
        playCard(cardId);
      }, 280);

      window.setTimeout(() => {
        setFlying(null);
        setHiddenInHand(null);
        throwLock.current = false;
      }, 950);
    },
    [legal, flying, playCard],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!snapshot || snapshot.phase !== GamePhase.Playing) return;
      if (e.key === 'r' || e.key === 'R') revealTrump();
      if (e.key === 'm' || e.key === 'M') declareMarriage();
      const n = Number(e.key);
      if (n >= 1 && n <= 8) {
        const hand = snapshot.players[you]?.hand ?? [];
        const card = hand[n - 1];
        if (card) onPlay(`${card.suit}${card.rank}`);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [snapshot, you, onPlay, revealTrump, declareMarriage]);

  if (!snapshot) return null;

  const hand = (snapshot.players[you]?.hand ?? [])
    .map((c) => Card.fromJSON(c))
    .filter((c) => c.id !== hiddenInHand);
  const isTurn =
    snapshot.toAct === you &&
    snapshot.phase === GamePhase.Playing &&
    !aiThinking &&
    !flying;
  const isSpectator = room?.spectators.some((s) => s.id === useGameStore.getState().playerId);
  const displayTrick = snapshot.currentTrick ?? heldTrick;

  // While our card is flying, hide it from the trick pile so we don't double-render
  const trickPlays =
    displayTrick?.plays.filter((p) => !(flying && p.seat === you && `${p.card.suit}${p.card.rank}` === flying.id)) ??
    [];

  const playerName = (seat: Seat) => {
    const fromRoom = room?.players.find((p) => p.seat === seat);
    return fromRoom?.name ?? snapshot.players[seat]?.name ?? seatDisplayName(seat);
  };

  const handCount = (seat: Seat): number => {
    if (engine) return engine.getState().players[seat].hand.length;
    const p = snapshot.players[seat] as { hand: unknown[]; handCount?: number };
    return p.handCount ?? p.hand?.length ?? 0;
  };

  return (
    <div className="h-full w-full min-h-0 flex flex-col">
      <div
        ref={tableRef}
        className="relative flex-1 min-h-0 w-full felt-table game-table-fit"
      >
        <div className="felt-sheen pointer-events-none" aria-hidden />

        <AnimatePresence>
          {trumpFlash && snapshot.trump.suit && (
            <motion.div
              className="absolute inset-0 z-30 flex items-center justify-center bg-black/35"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="text-center text-cream"
                initial={{ scale: 0.5, rotate: -8 }}
                animate={{ scale: 1.1, rotate: 0 }}
              >
                <div className="text-5xl text-gold">{suitSymbol(snapshot.trump.suit as Suit)}</div>
                <div className="font-display text-xl mt-1">
                  Trump: {suitDisplayName(snapshot.trump.suit as Suit)}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center HUD */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-center text-cream/90 -mt-6">
            <div className="font-display text-xl md:text-2xl text-gold-soft">29</div>
            <div className="text-[10px] uppercase tracking-widest opacity-70">
              {snapshot.phase}
              {aiThinking ? ' · thinking…' : ''}
            </div>
            {snapshot.trump.suit && (
              <div className="mt-0.5 text-gold-soft text-xs font-semibold">
                {snapshot.trump.revealed
                  ? `${suitDisplayName(snapshot.trump.suit as Suit)} ${suitSymbol(snapshot.trump.suit as Suit)}`
                  : 'Trump hidden'}
              </div>
            )}
            <AnimatePresence>
              {lastTrickWinner && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-1 text-gold font-bold text-sm"
                >
                  {seatDisplayName(lastTrickWinner)} wins trick
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Opponents */}
        {ALL_SEATS.filter((s) => s !== you || isSpectator).map((seat) => {
          if (seat === you && !isSpectator) return null;
          const visual = relativeSeat(seat, isSpectator ? Seat.South : you);
          if (visual === Seat.South && !isSpectator) return null;
          const count = handCount(seat);
          const active =
            !aiThinking &&
            (snapshot.toAct === seat ||
              (snapshot.phase === GamePhase.Bidding && snapshot.auction.toAct === seat));
          const thinkingHere = aiThinking && snapshot.toAct === seat;
          return (
            <div
              key={seat}
              className={`absolute ${SEAT_POS[visual]} flex flex-col items-center gap-0.5 z-20`}
            >
              <div
                className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold ${
                  active || thinkingHere ? 'bg-gold text-ink' : 'bg-black/40 text-cream'
                }`}
              >
                {playerName(seat)}
                {thinkingHere ? ' …' : ''}
                {snapshot.dealer === seat ? ' ·D' : ''}
              </div>
              <div className="flex -space-x-5 md:-space-x-6">
                {Array.from({ length: Math.min(count, 8) }).map((_, i) => (
                  <PlayingCard
                    key={`${dealKey}-${seat}-${i}`}
                    suit={'S' as Suit}
                    rank={'7' as Rank}
                    faceDown
                    size="sm"
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Trick pile */}
        <AnimatePresence mode="sync">
          {trickPlays.map((play, idx) => {
            const visual = relativeSeat(play.seat as Seat, isSpectator ? Seat.South : you);
            const origin = TRICK_ORIGIN[visual];
            return (
              <motion.div
                key={`${displayTrick!.index}-${play.seat}-${play.card.suit}${play.card.rank}`}
                className={`absolute ${TRICK_POS[visual]} z-20`}
                initial={{
                  scale: 0.75,
                  opacity: 0.2,
                  x: origin.x,
                  y: origin.y,
                  rotate: visual === Seat.South ? 8 : origin.x !== 0 ? 10 : -8,
                }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  x: 0,
                  y: 0,
                  rotate: (idx - 1.5) * 4,
                }}
                exit={{ opacity: 0, y: -30, transition: { duration: 0.4 } }}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              >
                <PlayingCard
                  suit={play.card.suit as Suit}
                  rank={play.card.rank as Rank}
                  size="md"
                />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Human throw — flies from hand into center */}
        <AnimatePresence>
          {flying && (
            <motion.div
              className="absolute left-1/2 top-[55%] z-40 pointer-events-none"
              style={{ marginLeft: -36, marginTop: -52 }}
              initial={{
                x: flying.fromX,
                y: flying.fromY,
                scale: 1.05,
                rotate: -6,
                opacity: 1,
              }}
              animate={{
                x: 0,
                y: 0,
                scale: 1,
                rotate: 4,
                opacity: 1,
              }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.85, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <PlayingCard suit={flying.suit} rank={flying.rank} size="md" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Your hand — inside the table so throws stay visible */}
        {!isSpectator && (
          <div className="absolute bottom-1 left-0 right-0 z-30 flex flex-col items-center gap-1 px-2">
            <div
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                isTurn ? 'bg-gold text-ink' : 'bg-black/45 text-cream'
              }`}
            >
              You{isTurn ? ' — play' : flying ? ' — throwing…' : aiThinking ? ' — wait' : ''}
            </div>
            <div className="flex justify-center gap-1 md:gap-1.5 max-w-full overflow-x-auto pb-1">
              <AnimatePresence mode="popLayout">
                {hand.map((card) => {
                  const id = card.id;
                  const canPlay = isTurn && legal.includes(id);
                  return (
                    <motion.div
                      key={id}
                      layout
                      initial={{ y: 24, opacity: 0 }}
                      animate={{ y: selected === id ? -10 : 0, opacity: 1 }}
                      exit={{ opacity: 0, scale: 0.6, y: -40 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                      ref={(node) => {
                        if (node) handRefs.current.set(id, node);
                        else handRefs.current.delete(id);
                      }}
                    >
                      <PlayingCard
                        suit={card.suit}
                        rank={card.rank}
                        size="md"
                        selected={selected === id}
                        disabled={!canPlay}
                        draggable={canPlay}
                        onClick={() => {
                          if (!canPlay) return;
                          if (selected === id) onPlay(id);
                          else setSelected(id);
                        }}
                        onDragEnd={() => onPlay(id)}
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            {snapshot.phase === GamePhase.Playing && (
              <div className="flex gap-1.5 pb-0.5">
                <button
                  type="button"
                  onClick={() => revealTrump()}
                  disabled={snapshot.trump.revealed || !snapshot.trump.suit}
                  className="text-[10px] px-2 py-0.5 bg-black/45 text-cream rounded-full disabled:opacity-30"
                >
                  Reveal (R)
                </button>
                <button
                  type="button"
                  onClick={() => declareMarriage()}
                  className="text-[10px] px-2 py-0.5 bg-black/45 text-cream rounded-full"
                >
                  Marriage (M)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
