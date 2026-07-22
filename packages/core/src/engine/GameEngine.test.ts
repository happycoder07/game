import { describe, it, expect } from 'vitest';
import {
  createPlayer,
  GameEngine,
  Seat,
  Suit,
  Rank,
  Card,
  GamePhase,
  TeamId,
  IllegalMoveError,
  scoreRound,
  applyRoundToScoreboard,
  DEFAULT_RULES,
} from '../index.js';

function fourPlayers() {
  return [
    createPlayer({ id: 'n', name: 'N', seat: Seat.North, kind: 'ai', aiLevel: 'easy' }),
    createPlayer({ id: 'e', name: 'E', seat: Seat.East, kind: 'ai', aiLevel: 'easy' }),
    createPlayer({ id: 's', name: 'S', seat: Seat.South, kind: 'human' }),
    createPlayer({ id: 'w', name: 'W', seat: Seat.West, kind: 'ai', aiLevel: 'easy' }),
  ];
}

describe('GameEngine integration', () => {
  it('deals 4 cards then enters bidding', () => {
    const eng = new GameEngine(fourPlayers(), { seed: 42, allowDouble: false });
    eng.startRound();
    const st = eng.getState();
    expect(st.phase).toBe(GamePhase.Bidding);
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      expect(st.players[seat].hand).toHaveLength(4);
    }
  });

  it('rejects out-of-turn bid', () => {
    const eng = new GameEngine(fourPlayers(), { seed: 1, allowDouble: false });
    eng.startRound();
    const toAct = eng.getState().auction.toAct;
    const other = toAct === Seat.North ? Seat.East : Seat.North;
    expect(() => eng.bid(other, 16)).toThrow(IllegalMoveError);
  });

  it('full round with forced flow reaches scoring', () => {
    const eng = new GameEngine(fourPlayers(), {
      seed: 99,
      allowDouble: false,
      forceBidIfAllPass: true,
    });
    eng.startRound();

    // Everyone passes → forced bid to dealer
    let guard = 0;
    while (eng.getState().phase === GamePhase.Bidding && guard++ < 10) {
      eng.pass(eng.getState().auction.toAct);
    }
    expect(eng.getState().phase).toBe(GamePhase.TrumpSelection);
    expect(eng.getState().contractBid).toBe(16);

    const bidder = eng.getState().contractBidder!;
    eng.chooseTrump(bidder, Suit.Hearts);
    expect(eng.getState().phase).toBe(GamePhase.Playing);
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      expect(eng.getState().players[seat].hand).toHaveLength(8);
    }

    // Play all 8 tricks with legal moves
    guard = 0;
    while (eng.getState().phase === GamePhase.Playing && guard++ < 40) {
      const seat = eng.getState().toAct!;
      const moves = eng.getLegalMoves(seat);
      expect(moves.length).toBeGreaterThan(0);
      eng.playCard(seat, moves[0]!);
    }

    const st = eng.getState();
    expect([GamePhase.RoundEnd, GamePhase.Finished]).toContain(st.phase);
    expect(st.pointsNS + st.pointsEW).toBe(29);
    expect(st.scoreboard.roundHistory).toHaveLength(1);
  });

  it('prevents playing card not in hand', () => {
    const eng = new GameEngine(fourPlayers(), { seed: 7, allowDouble: false });
    eng.startRound();
    while (eng.getState().phase === GamePhase.Bidding) {
      const act = eng.getState().auction.toAct;
      const legal = eng.getLegalBids(act);
      if (legal.length) eng.bid(act, legal[0]!);
      else eng.pass(act);
    }
    eng.chooseTrump(eng.getState().contractBidder!, Suit.Spades);
    const seat = eng.getState().toAct!;
    expect(() => eng.playCard(seat, 'S2')).toThrow(/not in hand|Illegal/);
  });

  it('cannot reveal twice', () => {
    const eng = new GameEngine(fourPlayers(), { seed: 3, allowDouble: false });
    eng.startRound();
    while (eng.getState().phase === GamePhase.Bidding) {
      eng.pass(eng.getState().auction.toAct);
    }
    eng.chooseTrump(eng.getState().contractBidder!, Suit.Diamonds);
    const seat = eng.getState().toAct!;
    eng.revealTrump(seat, 'voluntary');
    expect(() => eng.revealTrump(seat, 'voluntary')).toThrow(/already revealed/);
  });

  it('serializes and restores', () => {
    const eng = new GameEngine(fourPlayers(), { seed: 11, allowDouble: false });
    eng.startRound();
    eng.pass(eng.getState().auction.toAct);
    const json = eng.saveGame();
    const loaded = GameEngine.loadGame(json);
    expect(loaded.getState().phase).toBe(eng.getState().phase);
    expect(loaded.getState().auction.history).toEqual(eng.getState().auction.history);
  });

  it('supports undo', () => {
    const eng = new GameEngine(fourPlayers(), { seed: 5, allowDouble: false });
    eng.startRound();
    const before = eng.getState().auction.history.length;
    const act = eng.getState().auction.toAct;
    eng.bid(act, 16);
    expect(eng.getState().auction.history.length).toBe(before + 1);
    eng.undo();
    expect(eng.getState().auction.history.length).toBe(before);
  });
});

describe('Marriage & scoring', () => {
  it('adjusts target when marriage declared', () => {
    const eng = new GameEngine(fourPlayers(), {
      seed: 12345,
      allowDouble: false,
      marriageRequiresWonTrick: false,
    });
    eng.startRound();
    // Force a known path: bid then trump, inject marriage into hand
    while (eng.getState().phase === GamePhase.Bidding) {
      const act = eng.getState().auction.toAct;
      if (eng.getState().auction.currentBid === null) eng.bid(act, 16);
      else eng.pass(act);
    }
    const bidder = eng.getState().contractBidder!;
    eng.chooseTrump(bidder, Suit.Spades);

    // Give bidder K+Q of trump
    const st = eng.getState();
    const hand = st.players[bidder].hand;
    // Replace two cards with KS QS if not present
    const ks = new Card(Suit.Spades, Rank.King);
    const qs = new Card(Suit.Spades, Rank.Queen);
    if (!hand.some((c) => c.equals(ks))) hand[0] = ks;
    if (!hand.some((c) => c.equals(qs))) hand[1] = qs;

    eng.revealTrump(eng.getState().toAct!, 'voluntary');
    eng.declareMarriage(bidder);
    expect(eng.getState().marriage.bidAdjustment).toBe(-4);
  });

  it('awards game point on made bid', () => {
    const round = scoreRound({
      bidValue: 16,
      adjustedTarget: 16,
      biddingTeam: TeamId.NS,
      bidderSeat: Seat.North,
      trump: Suit.Hearts,
      pointsNS: 20,
      pointsEW: 9,
      multiplier: 1,
    });
    expect(round.bidMade).toBe(true);
    expect(round.gamePointDelta).toBe(1);
    const board = applyRoundToScoreboard(0, 0, round, DEFAULT_RULES);
    expect(board.ns).toBe(1);
  });
});
