import { TeamId } from './Team.js';
import { Seat } from './Seat.js';
import { Suit } from './Suit.js';

/** Per-round scoring snapshot. */
export interface RoundScore {
  bidValue: number;
  /** Bid after marriage adjustments (clamped by rules). */
  adjustedTarget: number;
  biddingTeam: TeamId;
  bidderSeat: Seat;
  trump: Suit | null;
  pointsNS: number;
  pointsEW: number;
  /** Did the bidding team meet the adjusted target? */
  bidMade: boolean;
  /** Game-point delta applied to the bidding team. */
  gamePointDelta: number;
  /** Optional double / redouble multiplier (1, 2, or 4). */
  multiplier: number;
}

export interface GameScoreboard {
  ns: number;
  ew: number;
  roundHistory: RoundScore[];
  /** First team to reach winTarget (default 6) wins; −loseTarget loses. */
  winner: TeamId | null;
}

export function createEmptyScoreboard(): GameScoreboard {
  return { ns: 0, ew: 0, roundHistory: [], winner: null };
}
