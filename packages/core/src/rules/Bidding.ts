import type { AuctionState, Bid } from '../entities/Bid.js';
import { nextSeat, Seat } from '../entities/Seat.js';
import type { RuleConfig } from './RuleConfig.js';

export class BidValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BidValidationError';
  }
}

export function validateBid(
  auction: AuctionState,
  seat: Seat,
  action: 'bid' | 'pass',
  value: number | undefined,
  rules: RuleConfig,
): void {
  if (auction.complete) {
    throw new BidValidationError('Auction is already complete');
  }
  if (seat !== auction.toAct) {
    throw new BidValidationError(`Not ${seat}'s turn to bid (to act: ${auction.toAct})`);
  }
  if (auction.passed.includes(seat)) {
    throw new BidValidationError(`${seat} has already passed`);
  }

  if (action === 'pass') {
    return;
  }

  if (value === undefined || !Number.isInteger(value)) {
    throw new BidValidationError('Bid value must be an integer');
  }
  if (value < rules.minBid || value > rules.maxBid) {
    throw new BidValidationError(
      `Bid must be between ${rules.minBid} and ${rules.maxBid}`,
    );
  }
  if (auction.currentBid !== null && value <= auction.currentBid) {
    throw new BidValidationError(
      `Bid must be higher than current bid of ${auction.currentBid}`,
    );
  }
}

/**
 * Apply a bid/pass and advance auction state. Returns updated auction
 * (does not mutate input).
 */
export function applyBid(
  auction: AuctionState,
  seat: Seat,
  action: 'bid' | 'pass',
  value: number | undefined,
  rules: RuleConfig,
): AuctionState {
  validateBid(auction, seat, action, value, rules);

  const bid: Bid = {
    seat,
    action,
    value: action === 'bid' ? value : undefined,
    order: auction.history.length,
  };

  const history = [...auction.history, bid];
  let currentBid = auction.currentBid;
  let highBidder = auction.highBidder;
  let passed = [...auction.passed];

  if (action === 'pass') {
    passed.push(seat);
  } else {
    currentBid = value!;
    highBidder = seat;
  }

  // Find next seat that hasn't passed
  let toAct = nextSeat(seat);
  let hops = 0;
  while (passed.includes(toAct) && hops < 4) {
    toAct = nextSeat(toAct);
    hops++;
  }

  // Auction complete when:
  // - 3 players passed and someone has bid, OR
  // - all 4 passed
  const activeBidders = ([Seat.North, Seat.East, Seat.South, Seat.West] as Seat[]).filter(
    (s) => !passed.includes(s),
  );

  let complete = false;
  if (passed.length === 4) {
    complete = true;
  } else if (currentBid !== null && passed.length === 3) {
    complete = true;
  } else if (currentBid !== null && activeBidders.length === 1 && activeBidders[0] === highBidder) {
    // Everyone else passed
    complete = true;
  }

  // Also complete if we've gone around and only high bidder remains active after a raise
  if (
    !complete &&
    currentBid !== null &&
    highBidder !== null &&
    passed.length >= 3
  ) {
    complete = true;
  }

  return {
    currentBid,
    highBidder,
    passed,
    history,
    toAct: complete ? (highBidder ?? seat) : toAct,
    complete,
  };
}

/**
 * Resolve auction outcome including forced-bid when all pass.
 */
export function resolveAuctionWinner(
  auction: AuctionState,
  dealer: Seat,
  firstBidder: Seat,
  rules: RuleConfig,
): { winner: Seat; bid: number } | null {
  if (!auction.complete) return null;

  if (auction.highBidder !== null && auction.currentBid !== null) {
    return { winner: auction.highBidder, bid: auction.currentBid };
  }

  // All passed
  if (rules.forceBidIfAllPass) {
    const winner = rules.forcedBidSeat === 'dealer' ? dealer : firstBidder;
    return { winner, bid: rules.minBid };
  }

  return null; // Redeal required — engine handles
}
