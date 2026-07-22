import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  GamePhase,
  Suit,
  suitSymbol,
  suitDisplayName,
  seatDisplayName,
  teamForSeat,
} from '@twenty-nine/core';
import { useGameStore } from '../store/gameStore';
import { legalBidsFromSnapshot } from '../lib/legalFromSnapshot';

/**
 * Floating, draggable points / bid / trump modal.
 * Drag from the green header to move it anywhere.
 */
export function BidDialog() {
  const snapshot = useGameStore((s) => s.snapshot);
  const engine = useGameStore((s) => s.engine);
  const room = useGameStore((s) => s.room);
  const mode = useGameStore((s) => s.mode);
  const you = useGameStore((s) => s.you);
  const bid = useGameStore((s) => s.bid);
  const pass = useGameStore((s) => s.pass);
  const chooseTrump = useGameStore((s) => s.chooseTrump);
  const passChallenge = useGameStore((s) => s.passChallenge);
  const double = useGameStore((s) => s.double);
  const redouble = useGameStore((s) => s.redouble);
  const leave = useGameStore((s) => s.leave);
  const startLocal = useGameStore((s) => s.startLocal);
  const dragControls = useDragControls();

  if (!snapshot) return null;

  const bidding = snapshot.phase === GamePhase.Bidding && snapshot.auction.toAct === you;
  const trumpSel =
    snapshot.phase === GamePhase.TrumpSelection && snapshot.contractBidder === you;
  const challenge = snapshot.phase === GamePhase.Challenge && snapshot.toAct === you;
  const roundEnd = snapshot.phase === GamePhase.RoundEnd;
  const finished = snapshot.phase === GamePhase.Finished;
  const waitingBid =
    snapshot.phase === GamePhase.Bidding && snapshot.auction.toAct !== you;

  const legalBids =
    bidding && snapshot
      ? engine
        ? engine.getLegalBids(you)
        : legalBidsFromSnapshot(snapshot, you)
      : [];

  const show =
    bidding || trumpSel || challenge || roundEnd || finished || waitingBid;
  if (!show) return null;

  const actorName = (seat: typeof you) => {
    const fromRoom = room?.players.find((p) => p.seat === seat);
    return fromRoom?.name ?? snapshot.players[seat]?.name ?? seatDisplayName(seat);
  };

  const title = bidding
    ? 'Select bid'
    : trumpSel
      ? 'Choose trump'
      : challenge
        ? 'Challenge'
        : roundEnd
          ? 'Round over'
          : finished
            ? 'Match finished'
            : 'Bidding';

  const panelKey = `${snapshot.phase}-${snapshot.auction.toAct}-${snapshot.roundNumber}`;

  const myTeam = teamForSeat(you);
  const canDouble =
    challenge &&
    snapshot.rules.allowDouble &&
    !snapshot.challenge.doubled &&
    snapshot.contractTeam != null &&
    myTeam !== snapshot.contractTeam;
  const canRedouble =
    challenge &&
    snapshot.rules.allowRedouble &&
    snapshot.challenge.doubled &&
    !snapshot.challenge.redoubled &&
    snapshot.contractTeam != null &&
    myTeam === snapshot.contractTeam;

  return (
    <AnimatePresence>
      <motion.div
        key={panelKey}
        role="dialog"
        aria-label={title}
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0.12}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed z-50 left-1/2 top-[14%] -translate-x-1/2 w-[min(100%-1.25rem,26rem)]"
      >
        <div className="bg-cream text-ink rounded-2xl shadow-2xl border border-gold/40 overflow-hidden ring-1 ring-black/10">
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="flex items-center justify-between gap-2 px-4 py-2.5 bg-felt text-cream cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="opacity-80 tracking-tighter text-base" aria-hidden>
                ⋮⋮
              </span>
              <h2 className="font-display text-lg truncate">{title}</h2>
            </div>
            <span className="text-[10px] uppercase tracking-wider opacity-70 shrink-0">
              Drag to move
            </span>
          </div>

          <div className="p-4 md:p-5">
            {waitingBid && !bidding && (
              <p className="text-sm text-center opacity-70">
                Waiting for {actorName(snapshot.auction.toAct)} to bid…
                {snapshot.auction.currentBid != null && (
                  <span className="ml-2 font-semibold">
                    Current {snapshot.auction.currentBid}
                  </span>
                )}
              </p>
            )}

            {bidding && (
              <>
                <p className="text-sm opacity-70 mb-3">
                  Current: <strong>{snapshot.auction.currentBid ?? '—'}</strong> · Range{' '}
                  {snapshot.rules.minBid}–{snapshot.rules.maxBid}
                </p>
                <div className="flex flex-wrap gap-2 mb-3 max-h-40 overflow-y-auto">
                  {legalBids.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => bid(v)}
                      className="min-w-12 h-12 px-3 rounded-xl bg-felt text-cream font-bold text-lg hover:bg-felt-light active:scale-95 transition"
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => pass()}
                  className="w-full py-2.5 rounded-xl border border-ink/20 font-semibold hover:bg-ink/5"
                >
                  Pass
                </button>
              </>
            )}

            {trumpSel && (
              <>
                <p className="text-sm opacity-70 mb-3">
                  Bid {snapshot.contractBid} — trump stays hidden
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {([Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs] as Suit[]).map(
                    (s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => chooseTrump(s)}
                        className="py-3 rounded-xl bg-felt text-cream text-lg font-bold hover:bg-felt-light"
                      >
                        {suitSymbol(s)} {suitDisplayName(s)}
                      </button>
                    ),
                  )}
                </div>
              </>
            )}

            {challenge && (
              <div className="flex flex-col gap-2">
                {canDouble && (
                  <button
                    type="button"
                    onClick={() => double()}
                    className="py-2.5 rounded-xl bg-danger text-cream font-semibold"
                  >
                    Double
                  </button>
                )}
                {canRedouble && (
                  <button
                    type="button"
                    onClick={() => redouble()}
                    className="py-2.5 rounded-xl bg-gold text-ink font-semibold"
                  >
                    Redouble
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => passChallenge()}
                  className="py-2.5 rounded-xl border border-ink/20 font-semibold"
                >
                  Pass
                </button>
              </div>
            )}

            {roundEnd && (
              <>
                <ScoreSummary />
                <NextRoundButton />
              </>
            )}

            {finished && (
              <>
                <p className="mb-3">
                  Winner: <strong>{snapshot.scoreboard.winner}</strong>
                </p>
                <ScoreSummary />
                {mode === 'online' ? (
                  <button
                    type="button"
                    onClick={() => leave()}
                    className="mt-3 w-full py-3 rounded-xl bg-felt text-cream font-semibold"
                  >
                    Leave room
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startLocal()}
                    className="mt-3 w-full py-3 rounded-xl bg-felt text-cream font-semibold"
                  >
                    Play again
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function NextRoundButton() {
  const nextRound = useGameStore((s) => s.nextRound);
  const mode = useGameStore((s) => s.mode);
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const isHost = mode === 'local' || (room != null && playerId === room.hostId);

  if (!isHost) {
    return <p className="mt-3 text-center text-sm opacity-70">Waiting for host to deal…</p>;
  }

  return (
    <button
      type="button"
      onClick={() => nextRound()}
      className="mt-3 w-full py-3 rounded-xl bg-felt text-cream font-semibold"
    >
      Next round
    </button>
  );
}

function ScoreSummary() {
  const snapshot = useGameStore((s) => s.snapshot);
  if (!snapshot) return null;
  const last = snapshot.scoreboard.roundHistory[snapshot.scoreboard.roundHistory.length - 1];
  return (
    <div className="text-sm space-y-1">
      <p>
        Game score — NS: <strong>{snapshot.scoreboard.ns}</strong> · EW:{' '}
        <strong>{snapshot.scoreboard.ew}</strong>
      </p>
      {last && (
        <p>
          Last bid {last.bidValue} (target {last.adjustedTarget}) —{' '}
          {last.bidMade ? 'made' : 'set'} ({last.gamePointDelta > 0 ? '+' : ''}
          {last.gamePointDelta})
        </p>
      )}
      <p>
        Card points — NS: {snapshot.pointsNS} · EW: {snapshot.pointsEW}
      </p>
    </div>
  );
}
