import { Suit } from './Suit.js';
import { Seat } from './Seat.js';

/**
 * Trump starts hidden after the bid winner selects it.
 * It is revealed when a player cannot follow suit and plays trump,
 * or when a player explicitly requests reveal (if rules allow),
 * or when auto-reveal rules fire.
 */
export interface TrumpState {
  suit: Suit | null;
  /** Seat that chose trump (bid winner). */
  chosenBy: Seat | null;
  revealed: boolean;
  /** Seat that caused the reveal, if any. */
  revealedBy: Seat | null;
  /** Trick index when revealed, if any. */
  revealedOnTrick: number | null;
}

export function createEmptyTrump(): TrumpState {
  return {
    suit: null,
    chosenBy: null,
    revealed: false,
    revealedBy: null,
    revealedOnTrick: null,
  };
}
