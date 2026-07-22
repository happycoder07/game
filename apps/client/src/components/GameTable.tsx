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
  hasMarriage,
  teamForSeat,
} from '@twenty-nine/core';
import { PlayingCard, cardHeightForWidth } from './PlayingCard';
import { useGameStore } from '../store/gameStore';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { legalMovesFromSnapshot } from '../lib/legalFromSnapshot';
import { AI_DELAY } from '../store/gameStore';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

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

/** Offsets from table center while a trick is being played. */
const PLAY_OFFSET: Record<Seat, { x: number; y: number }> = {
  [Seat.North]: { x: 0, y: -78 },
  [Seat.East]: { x: 98, y: 8 },
  [Seat.South]: { x: 0, y: 88 },
  [Seat.West]: { x: -98, y: 8 },
};

/** Where collected cards fly when a seat wins the hand. */
const COLLECT_OFFSET: Record<Seat, { x: number; y: number }> = {
  [Seat.North]: { x: 0, y: -175 },
  [Seat.East]: { x: 210, y: -10 },
  [Seat.South]: { x: 0, y: 185 },
  [Seat.West]: { x: -210, y: -10 },
};

/** Entrance flight from seat toward center. */
const TRICK_ORIGIN: Record<Seat, { x: number; y: number }> = {
  [Seat.North]: { x: 0, y: -110 },
  [Seat.East]: { x: 130, y: 0 },
  [Seat.South]: { x: 0, y: 120 },
  [Seat.West]: { x: -130, y: 0 },
};

/** Must match the human throw motion.div transition duration. */
const THROW_FLY_MS = 820;
/** Pause with cards on table, then sweep them to the winner. */
const GATHER_DELAY_MS = 480;
const GATHER_MS = 900;

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
  const pendingPlay = useGameStore((s) => s.pendingPlay);
  const mode = useGameStore((s) => s.mode);
  const tableRef = useRef<HTMLDivElement>(null);
  const handRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [tableSize, setTableSize] = useState({ w: 900, h: 560 });

  const [selected, setSelected] = useState<string | null>(null);
  const [lastTrickWinner, setLastTrickWinner] = useState<Seat | null>(null);
  const [trumpFlash, setTrumpFlash] = useState(false);
  const [dealKey, setDealKey] = useState(0);
  const [heldTrick, setHeldTrick] = useState<TrickJSON | null>(null);
  const [flying, setFlying] = useState<FlyingCard | null>(null);
  const [hiddenInHand, setHiddenInHand] = useState<string | null>(null);
  const [gathering, setGathering] = useState(false);
  const prevTrickCount = useRef(0);
  const throwLock = useRef(false);
  const flyTimers = useRef<number[]>([]);
  /** Card ids that already flew in — skip trick-pile entrance remount. */
  const skipEntrance = useRef(new Set<string>());
  const prevTrumpRevealed = useRef(false);

  const legal = useMemo(() => {
    if (!snapshot || flying || pendingPlay) return [] as string[];
    if (engine) {
      if (snapshot.phase !== GamePhase.Playing || snapshot.toAct !== you) return [];
      return engine.getLegalMoves(you);
    }
    return legalMovesFromSnapshot(snapshot, you);
  }, [engine, snapshot, you, flying, pendingPlay]);

  useEffect(() => {
    if (!snapshot) return;
    const count = snapshot.tricks.length;
    if (count > prevTrickCount.current) {
      const last = snapshot.tricks[count - 1]!;
      setHeldTrick(last);
      setLastTrickWinner(last.winner ?? null);
      prevTrickCount.current = count;
    }
    // Next trick started — drop the hold so the new play can show
    if (heldTrick && (snapshot.currentTrick?.plays.length ?? 0) > 0) {
      setHeldTrick(null);
      setLastTrickWinner(null);
    }
  }, [snapshot, heldTrick]);

  useEffect(() => {
    if (!heldTrick || !lastTrickWinner) {
      setGathering(false);
      return;
    }
    setGathering(false);
    const t = window.setTimeout(() => setGathering(true), GATHER_DELAY_MS);
    return () => clearTimeout(t);
  }, [heldTrick, lastTrickWinner]);

  useEffect(() => {
    if (!heldTrick) return;
    const t = window.setTimeout(() => {
      setHeldTrick(null);
      setLastTrickWinner(null);
      setGathering(false);
    }, AI_DELAY.afterTrick);
    return () => clearTimeout(t);
  }, [heldTrick]);

  useEffect(() => {
    const revealed = Boolean(snapshot?.trump.revealed);
    if (revealed && !prevTrumpRevealed.current) {
      setTrumpFlash(true);
      const t = window.setTimeout(() => setTrumpFlash(false), 1400);
      prevTrumpRevealed.current = true;
      return () => clearTimeout(t);
    }
    if (!revealed) prevTrumpRevealed.current = false;
  }, [snapshot?.trump.revealed]);

  useEffect(() => {
    setDealKey((k) => k + 1);
    prevTrickCount.current = 0;
    setHeldTrick(null);
    setLastTrickWinner(null);
    setFlying(null);
    setHiddenInHand(null);
    setSelected(null);
    setGathering(false);
    throwLock.current = false;
    skipEntrance.current.clear();
    for (const id of flyTimers.current) window.clearTimeout(id);
    flyTimers.current = [];
  }, [snapshot?.roundNumber]);

  // Clear throw timers on unmount / leave so playCard can't fire after teardown
  useEffect(() => {
    return () => {
      for (const id of flyTimers.current) window.clearTimeout(id);
      flyTimers.current = [];
      throwLock.current = false;
    };
  }, []);

  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setTableSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [snapshot]);

  const cardWidths = useMemo(() => {
    const { w, h } = tableSize;
    const uiScale = clamp(Math.min(w / 860, h / 520), 0.88, 1.4);
    const handGap = Math.round(5 * uiScale + 2);
    const handPad = Math.round(28 * uiScale);
    const hand = clamp(
      Math.min((w - handPad - handGap * 7) / 8, h / 5.6, w / 8.8),
      Math.round(56 * uiScale),
      Math.round(118 * uiScale),
    );
    const trick = clamp(hand * 0.92, Math.round(54 * uiScale), Math.round(108 * uiScale));
    const opp = clamp(hand * 0.72, Math.round(48 * uiScale), Math.round(86 * uiScale));
    return {
      hand,
      trick,
      opp,
      handGap,
      uiScale,
      namePx: Math.round(13 * uiScale + 1),
      youPx: Math.round(13 * uiScale + 2),
      badgePx: Math.round(11 * uiScale + 1),
      badgeMin: Math.round(22 * uiScale),
      actionH: Math.round(44 * uiScale),
      actionIcon: Math.round(20 * uiScale),
      actionLabel: Math.round(12 * uiScale + 1),
    };
  }, [tableSize]);

  const onPlay = useCallback(
    (cardId: string) => {
      if (!legal.includes(cardId) || throwLock.current || flying || pendingPlay) return;
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

      const land = window.setTimeout(() => {
        skipEntrance.current.add(cardId);
        playCard(cardId);
        setFlying(null);
        // Keep card hidden online until GameState clears pendingPlay
        if (mode !== 'online') setHiddenInHand(null);
        throwLock.current = false;
      }, THROW_FLY_MS);
      flyTimers.current.push(land);
    },
    [legal, flying, playCard, pendingPlay, mode],
  );

  useEffect(() => {
    if (!pendingPlay) setHiddenInHand(null);
  }, [pendingPlay]);

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

  const tricksWon = useMemo(() => {
    const counts: Record<Seat, number> = {
      [Seat.North]: 0,
      [Seat.East]: 0,
      [Seat.South]: 0,
      [Seat.West]: 0,
    };
    if (!snapshot) return counts;
    for (const t of snapshot.tricks) {
      if (t.winner) counts[t.winner as Seat] += 1;
    }
    return counts;
  }, [snapshot?.tricks]);

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
  // Prefer held completed trick while the engine has already opened an empty next trick
  const displayTrick =
    (snapshot.currentTrick?.plays.length ?? 0) > 0
      ? snapshot.currentTrick
      : heldTrick;

  // While our card is flying, hide it from the trick pile so we don't double-render
  const trickPlays =
    displayTrick?.plays.filter((p) => !(flying && p.seat === you && `${p.card.suit}${p.card.rank}` === flying.id)) ??
    [];

  const originScale = cardWidths.trick / 72;
  const playerName = (seat: Seat) => {
    const fromRoom = room?.players.find((p) => p.seat === seat);
    return fromRoom?.name ?? snapshot.players[seat]?.name ?? seatDisplayName(seat);
  };

  const handCount = (seat: Seat): number => {
    if (engine) return engine.getState().players[seat].hand.length;
    const p = snapshot.players[seat] as { hand: unknown[]; handCount?: number };
    return p.handCount ?? p.hand?.length ?? 0;
  };

  const trickBadge = (seat: Seat) => (
    <span
      className="inline-flex items-center justify-center rounded-full bg-gold/90 text-ink font-bold tabular-nums shadow"
      style={{
        minWidth: cardWidths.badgeMin,
        height: cardWidths.badgeMin,
        paddingInline: Math.round(cardWidths.badgeMin * 0.28),
        fontSize: cardWidths.badgePx,
      }}
      title="Tricks won this round"
      aria-label={`${tricksWon[seat]} tricks won`}
    >
      {tricksWon[seat]}
    </span>
  );

  const canReveal =
    snapshot.phase === GamePhase.Playing &&
    Boolean(snapshot.trump.suit) &&
    !snapshot.trump.revealed;
  const showActions = snapshot.phase === GamePhase.Playing;

  return (
    <div className="h-full w-full min-h-0 flex flex-col overflow-visible">
      <div
        ref={tableRef}
        className="relative flex-1 min-h-0 w-full felt-table game-table-fit overflow-visible"
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

        {/* Center HUD — kept light; details live in the right panel */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-center -mt-8">
            <div className="font-display text-3xl md:text-4xl text-gold-soft/90 tracking-wide drop-shadow">
              29
            </div>
            <div className="mt-0.5 text-[11px] md:text-xs uppercase tracking-[0.22em] text-cream/55">
              {snapshot.phase}
              {aiThinking ? ' · thinking' : ''}
            </div>
          </div>
        </div>

        {/* Hand / trick winner celebration */}
        <AnimatePresence>
          {lastTrickWinner && heldTrick && gathering && (
            <motion.div
              className="absolute inset-0 z-[35] flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="absolute w-40 h-40 md:w-52 md:h-52 rounded-full bg-gold/20 blur-2xl"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1.25, opacity: [0.35, 0.7, 0.25] }}
                transition={{ duration: 1.4, ease: 'easeOut' }}
              />
              <motion.div
                className="relative text-center px-5 py-3 rounded-2xl bg-ink/75 border border-gold/50 shadow-2xl backdrop-blur-sm"
                initial={{ scale: 0.55, y: 18, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 18 }}
              >
                <div className="text-[10px] uppercase tracking-[0.2em] text-gold-soft/80">
                  Hand won
                </div>
                <div className="font-display text-2xl md:text-3xl text-gold mt-0.5">
                  {seatDisplayName(lastTrickWinner)}
                </div>
                <div className="text-sm text-cream/85 mt-1 tabular-nums">
                  +{heldTrick.cardPoints} pts
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
          const wonThis = lastTrickWinner === seat;
          return (
            <div
              key={seat}
              className={`absolute ${SEAT_POS[visual]} flex flex-col items-center gap-1 z-20`}
            >
              <div
                className={`flex items-center gap-2 ${visual === Seat.East ? 'flex-row-reverse' : ''} ${
                  wonThis ? 'winner-pulse' : ''
                }`}
              >
                <div
                  className={`rounded-full font-semibold transition-colors ${
                    wonThis
                      ? 'bg-gold text-ink ring-2 ring-gold-soft'
                      : active || thinkingHere
                        ? 'bg-gold text-ink'
                        : 'bg-black/45 text-cream'
                  }`}
                  style={{
                    fontSize: cardWidths.namePx,
                    padding: `${Math.round(4 * cardWidths.uiScale)}px ${Math.round(10 * cardWidths.uiScale)}px`,
                  }}
                >
                  {playerName(seat)}
                  {thinkingHere ? ' …' : ''}
                  {snapshot.dealer === seat ? ' ·D' : ''}
                </div>
                {trickBadge(seat)}
              </div>
              <div className="flex">
                {Array.from({ length: Math.min(count, 8) }).map((_, i) => (
                  <div
                    key={`${dealKey}-${seat}-${i}`}
                    style={{ marginLeft: i === 0 ? 0 : -Math.round(cardWidths.opp * 0.52) }}
                  >
                    <PlayingCard
                      suit={'S' as Suit}
                      rank={'7' as Rank}
                      faceDown
                      noMotion
                      width={cardWidths.opp}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Trick pile — shared center anchor; on win all four fly to the winner */}
        <AnimatePresence mode="sync">
          {trickPlays.map((play, idx) => {
            const visual = relativeSeat(play.seat as Seat, isSpectator ? Seat.South : you);
            const origin = TRICK_ORIGIN[visual];
            const playAt = PLAY_OFFSET[visual];
            const cardId = `${play.card.suit}${play.card.rank}`;
            const skip = skipEntrance.current.has(cardId);
            const winVisual = lastTrickWinner
              ? relativeSeat(lastTrickWinner, isSpectator ? Seat.South : you)
              : null;
            const collect = winVisual ? COLLECT_OFFSET[winVisual] : playAt;
            const scale = originScale;
            const fan = (idx - 1.5) * 10;
            return (
              <motion.div
                key={`${displayTrick!.index}-${play.seat}-${cardId}`}
                className="absolute left-1/2 top-[48%] z-20 pointer-events-none"
                style={{
                  marginLeft: -cardWidths.trick / 2,
                  marginTop: -cardHeightForWidth(cardWidths.trick) / 2,
                }}
                initial={
                  skip
                    ? {
                        x: playAt.x * scale,
                        y: playAt.y * scale,
                        scale: 1,
                        opacity: 1,
                        rotate: (idx - 1.5) * 4,
                      }
                    : {
                        x: origin.x * scale,
                        y: origin.y * scale,
                        scale: 0.85,
                        opacity: 0.35,
                        rotate: visual === Seat.South ? 8 : origin.x !== 0 ? 10 : -8,
                      }
                }
                animate={
                  gathering && winVisual
                    ? {
                        x: collect.x * scale + fan * 0.35,
                        y: collect.y * scale,
                        scale: 0.48,
                        opacity: 0.95,
                        rotate: fan * 0.6,
                      }
                    : {
                        x: playAt.x * scale,
                        y: playAt.y * scale,
                        scale: 1,
                        opacity: 1,
                        rotate: (idx - 1.5) * 4,
                      }
                }
                exit={{
                  opacity: 0,
                  scale: 0.35,
                  transition: { duration: 0.28 },
                }}
                transition={
                  gathering
                    ? {
                        duration: GATHER_MS / 1000,
                        ease: [0.22, 1, 0.36, 1],
                        delay: idx * 0.04,
                      }
                    : {
                        duration: THROW_FLY_MS / 1000,
                        ease: [0.22, 1, 0.36, 1],
                      }
                }
              >
                <PlayingCard
                  suit={play.card.suit as Suit}
                  rank={play.card.rank as Rank}
                  width={cardWidths.trick}
                  noMotion
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
              style={{
                marginLeft: -cardWidths.trick / 2,
                marginTop: -cardHeightForWidth(cardWidths.trick) / 2,
              }}
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
              exit={{ opacity: 0, transition: { duration: 0.05 } }}
              transition={{ duration: THROW_FLY_MS / 1000, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <PlayingCard
                suit={flying.suit}
                rank={flying.rank}
                width={cardWidths.trick}
                noMotion
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reveal — top-left corner */}
        {!isSpectator && showActions && (
          <button
            type="button"
            onClick={() => revealTrump()}
            disabled={!canReveal}
            title="Reveal trump (R)"
            aria-label="Reveal trump"
            className="absolute top-3 left-3 z-30 pointer-events-auto flex flex-col items-center justify-center gap-0.5 rounded-2xl bg-black/55 text-cream border border-gold/40 hover:bg-black/70 hover:border-gold/65 disabled:opacity-35 disabled:cursor-not-allowed shadow-lg backdrop-blur-sm transition"
            style={{
              width: Math.round(cardWidths.actionH * 1.4),
              minHeight: cardWidths.actionH,
              padding: Math.round(6 * cardWidths.uiScale),
            }}
          >
            <svg
              width={cardWidths.actionIcon}
              height={cardWidths.actionIcon}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M2.5 12S6.5 5.5 12 5.5 21.5 12 21.5 12 17.5 18.5 12 18.5 2.5 12 2.5 12Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="font-semibold tracking-wide uppercase text-gold-soft"
              style={{ fontSize: cardWidths.actionLabel }}
            >
              Reveal
            </span>
          </button>
        )}

        {/* Marriage — bottom-left corner */}
        {!isSpectator && showActions && (
          <button
            type="button"
            onClick={() => declareMarriage()}
            title="Declare marriage (M)"
            aria-label="Declare marriage"
            className="absolute bottom-3 left-3 z-30 pointer-events-auto flex flex-col items-center justify-center gap-0.5 rounded-2xl bg-black/55 text-cream border border-gold/40 hover:bg-black/70 hover:border-gold/65 shadow-lg backdrop-blur-sm transition"
            style={{
              width: Math.round(cardWidths.actionH * 1.4),
              minHeight: cardWidths.actionH,
              padding: Math.round(6 * cardWidths.uiScale),
            }}
          >
            <svg
              width={cardWidths.actionIcon}
              height={cardWidths.actionIcon}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
              className="text-gold-soft"
            >
              <path
                d="M12 21s-6.5-4.2-8.8-8.1C1.4 9.7 2.6 6.2 5.8 5.3c1.8-.5 3.6.2 4.7 1.6L12 8.5l1.5-1.6c1.1-1.4 2.9-2.1 4.7-1.6 3.2.9 4.4 4.4 2.6 7.6C18.5 16.8 12 21 12 21Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M9 12.5h6M12 9.5v6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span
              className="font-semibold tracking-wide uppercase text-gold-soft"
              style={{ fontSize: cardWidths.actionLabel }}
            >
              Marriage
            </span>
          </button>
        )}

        {/* Your hand */}
        {!isSpectator && (
          <div className="absolute bottom-1 left-0 right-0 z-30 flex flex-col items-center gap-1 px-2 overflow-visible pointer-events-none">
            <div
              className={`pointer-events-auto flex items-center gap-2 ${
                lastTrickWinner === you ? 'winner-pulse' : ''
              }`}
            >
              <div
                className={`rounded-full font-semibold ${
                  lastTrickWinner === you
                    ? 'bg-gold text-ink ring-2 ring-gold-soft'
                    : isTurn
                      ? 'bg-gold text-ink'
                      : 'bg-black/45 text-cream'
                }`}
                style={{
                  fontSize: cardWidths.youPx,
                  padding: `${Math.round(5 * cardWidths.uiScale)}px ${Math.round(12 * cardWidths.uiScale)}px`,
                }}
              >
                You{isTurn ? ' — play' : flying ? ' — throwing…' : aiThinking ? ' — wait' : ''}
              </div>
              {trickBadge(you)}
            </div>

            <div
              className="hand-row pointer-events-auto flex justify-center items-end"
              style={{
                gap: cardWidths.handGap,
                paddingTop: Math.round(cardHeightForWidth(cardWidths.hand) * 0.55),
                marginTop: -Math.round(cardHeightForWidth(cardWidths.hand) * 0.55),
              }}
            >
              <AnimatePresence mode="popLayout">
                {hand.map((card) => {
                  const id = card.id;
                  const canPlay = isTurn && legal.includes(id);
                  return (
                    <motion.div
                      key={id}
                      layout
                      initial={{ y: 24, opacity: 0 }}
                      animate={{ y: selected === id ? -12 : 0, opacity: 1 }}
                      exit={{ opacity: 0, scale: 0.6, y: -40 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                      className="relative shrink-0"
                      style={{ zIndex: selected === id ? 5 : 1 }}
                      whileHover={canPlay ? { zIndex: 8 } : undefined}
                      ref={(node) => {
                        if (node) handRefs.current.set(id, node);
                        else handRefs.current.delete(id);
                      }}
                    >
                      <PlayingCard
                        suit={card.suit}
                        rank={card.rank}
                        width={cardWidths.hand}
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
          </div>
        )}
      </div>
    </div>
  );
}
