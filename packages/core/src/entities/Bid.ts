import { Seat } from './Seat.js';

export type BidAction = 'bid' | 'pass';

export interface Bid {
  seat: Seat;
  action: BidAction;
  /** Present when action === 'bid'; range typically 16–28. */
  value?: number;
  /** Sequential index within the auction. */
  order: number;
}

export interface BidJSON {
  seat: Seat;
  action: BidAction;
  value?: number;
  order: number;
}

export interface AuctionState {
  /** Highest accepted bid value, or null if everyone passed / not started. */
  currentBid: number | null;
  /** Seat that placed the current high bid. */
  highBidder: Seat | null;
  /** Seats that have passed this auction (cannot re-enter). */
  passed: Seat[];
  history: Bid[];
  /** Seat whose turn it is to bid. */
  toAct: Seat;
  /** True when auction is complete. */
  complete: boolean;
}

export function createEmptyAuction(firstBidder: Seat): AuctionState {
  return {
    currentBid: null,
    highBidder: null,
    passed: [],
    history: [],
    toAct: firstBidder,
    complete: false,
  };
}
