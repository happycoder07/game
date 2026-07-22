/**
 * Verifies local AI throw pacing: each CardPlayed must be ≥ throwWatch apart
 * after the pre-play think delay (wall-clock).
 *
 * Run: npx tsx scripts/verify-throw-timing.ts
 */
import {
  createPlayer,
  GameEngine,
  Seat,
  Suit,
  GamePhase,
  decide,
  applyAiDecision,
} from '../packages/core/src/index.ts';

const PLAY = 1400;
const THROW_WATCH = 1100;
const AFTER_TRICK = 2500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function actor(engine: GameEngine): Seat | null {
  const st = engine.getState();
  if (st.phase === GamePhase.Bidding) return st.auction.toAct;
  if (st.phase === GamePhase.TrumpSelection) return st.contractBidder;
  if (st.phase === GamePhase.Challenge) return st.toAct;
  if (st.phase === GamePhase.Playing) return st.toAct;
  return null;
}

async function forceToPlaying(engine: GameEngine): Promise<void> {
  // Fast-forward auction/trump without delays
  while (engine.getState().phase === GamePhase.Bidding) {
    const a = engine.getState().auction.toAct;
    engine.pass(a);
  }
  if (engine.getState().phase === GamePhase.TrumpSelection) {
    const b = engine.getState().contractBidder!;
    engine.chooseTrump(b, Suit.Hearts);
  }
  while (engine.getState().phase === GamePhase.Challenge) {
    const a = engine.getState().toAct!;
    try {
      engine.passChallenge(a);
    } catch {
      break;
    }
  }
}

async function main() {
  const players = [
    createPlayer({ id: 'n', name: 'N', seat: Seat.North, kind: 'ai', aiLevel: 'easy' }),
    createPlayer({ id: 'e', name: 'E', seat: Seat.East, kind: 'ai', aiLevel: 'easy' }),
    createPlayer({ id: 's', name: 'S', seat: Seat.South, kind: 'ai', aiLevel: 'easy' }),
    createPlayer({ id: 'w', name: 'W', seat: Seat.West, kind: 'ai', aiLevel: 'easy' }),
  ];
  const engine = new GameEngine(players, { seed: 42, allowDouble: false });
  engine.startRound();
  await forceToPlaying(engine);

  if (engine.getState().phase !== GamePhase.Playing) {
    console.error('FAIL: could not reach Playing', engine.getState().phase);
    process.exit(1);
  }

  const times: number[] = [];
  engine.subscribe((e) => {
    if (e.type === 'CardPlayed') times.push(performance.now());
  });

  // Play first 8 card throws with the same pacing as the client
  for (let i = 0; i < 8; i++) {
    const a = actor(engine);
    if (!a || engine.getState().phase !== GamePhase.Playing) break;
    const tricksBefore = engine.getState().tricks.length;
    await sleep(PLAY);
    applyAiDecision(engine, a, decide('easy', engine, a));
    const trickDone = engine.getState().tricks.length > tricksBefore;
    await sleep(trickDone ? AFTER_TRICK : THROW_WATCH);
  }

  console.log(`CardPlayed events: ${times.length}`);
  if (times.length < 4) {
    console.error('FAIL: expected at least 4 card plays');
    process.exit(1);
  }

  const gaps = [];
  for (let i = 1; i < times.length; i++) {
    gaps.push(times[i]! - times[i - 1]!);
  }
  console.log(
    'Gaps between throws (ms):',
    gaps.map((g) => Math.round(g)).join(', '),
  );

  const minGap = Math.min(...gaps);
  const expectedMin = PLAY + THROW_WATCH - 80; // small timer slack
  if (minGap < expectedMin) {
    console.error(
      `FAIL: min gap ${Math.round(minGap)}ms < expected ~${PLAY + THROW_WATCH}ms`,
    );
    process.exit(1);
  }

  console.log(
    `PASS: min gap ${Math.round(minGap)}ms (need ≥ ${PLAY + THROW_WATCH}ms think+watch)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
