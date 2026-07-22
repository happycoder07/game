import { Seat } from './Seat.js';
import { TeamId } from './Team.js';
import { Suit } from './Suit.js';

/**
 * Official marriage (pair / royals): King + Queen of trump.
 *
 * Valid only after trump is revealed.
 * Typical regional effect (configurable):
 *   - Bidding team declares  → required bid target decreases by marriageDelta
 *   - Defending team declares → required bid target increases by marriageDelta
 *
 * Some regions require the declaring side to have won a trick after reveal.
 */
export interface MarriageDeclaration {
  seat: Seat;
  team: TeamId;
  trump: Suit;
  /** Trick index when declared. */
  trickIndex: number;
}

export interface MarriageState {
  declarations: MarriageDeclaration[];
  /** Net adjustment applied to the bid target (negative = easier for bidders). */
  bidAdjustment: number;
}

export function createEmptyMarriage(): MarriageState {
  return { declarations: [], bidAdjustment: 0 };
}
