import { describe, it, expect } from 'vitest';
import {
  createEmptyAuction,
  applyBid,
  resolveAuctionWinner,
  Seat,
  DEFAULT_RULES,
  BidValidationError,
  nextSeat,
} from '../index.js';

describe('Bidding', () => {
  const dealer = Seat.South;
  const first = nextSeat(dealer); // West? Wait: next of South is West
  // CLOCKWISE: N E S W — nextSeat(South)=West. Hmm typically left of dealer.
  // If dealer is South, left (clockwise) is West. OK.

  it('rejects bid below minimum', () => {
    const a = createEmptyAuction(Seat.West);
    expect(() => applyBid(a, Seat.West, 'bid', 10, DEFAULT_RULES)).toThrow(BidValidationError);
  });

  it('rejects non-raising bid', () => {
    let a = createEmptyAuction(Seat.West);
    a = applyBid(a, Seat.West, 'bid', 16, DEFAULT_RULES);
    a = applyBid(a, Seat.North, 'pass', undefined, DEFAULT_RULES);
    expect(() => applyBid(a, Seat.East, 'bid', 16, DEFAULT_RULES)).toThrow(/higher/);
  });

  it('completes when three pass after a bid', () => {
    let a = createEmptyAuction(Seat.West);
    a = applyBid(a, Seat.West, 'bid', 17, DEFAULT_RULES);
    a = applyBid(a, Seat.North, 'pass', undefined, DEFAULT_RULES);
    a = applyBid(a, Seat.East, 'pass', undefined, DEFAULT_RULES);
    a = applyBid(a, Seat.South, 'pass', undefined, DEFAULT_RULES);
    expect(a.complete).toBe(true);
    const w = resolveAuctionWinner(a, dealer, first, DEFAULT_RULES);
    expect(w).toEqual({ winner: Seat.West, bid: 17 });
  });

  it('forces min bid when all pass', () => {
    let a = createEmptyAuction(Seat.West);
    for (const s of [Seat.West, Seat.North, Seat.East, Seat.South]) {
      a = applyBid(a, s, 'pass', undefined, DEFAULT_RULES);
    }
    expect(a.complete).toBe(true);
    const w = resolveAuctionWinner(a, dealer, Seat.West, DEFAULT_RULES);
    expect(w?.bid).toBe(16);
    expect(w?.winner).toBe(dealer); // forcedBidSeat: dealer
  });

  it('allows raising through auction', () => {
    let a = createEmptyAuction(Seat.West);
    a = applyBid(a, Seat.West, 'bid', 16, DEFAULT_RULES);
    a = applyBid(a, Seat.North, 'bid', 18, DEFAULT_RULES);
    a = applyBid(a, Seat.East, 'pass', undefined, DEFAULT_RULES);
    a = applyBid(a, Seat.South, 'pass', undefined, DEFAULT_RULES);
    a = applyBid(a, Seat.West, 'pass', undefined, DEFAULT_RULES);
    expect(a.complete).toBe(true);
    expect(a.highBidder).toBe(Seat.North);
    expect(a.currentBid).toBe(18);
  });
});
