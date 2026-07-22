import { Card } from '../entities/Card.js';
import { Suit } from '../entities/Suit.js';
import type { Trick } from '../entities/Trick.js';
import type { RuleConfig } from '../rules/RuleConfig.js';

/**
 * Determine the winner of a completed trick.
 *
 * Rules:
 * 1. If any trump was played AND trump is revealed (or being resolved with known trump),
 *    the highest trump wins.
 * 2. Otherwise the highest card of the lead suit wins.
 * 3. Off-suit non-trump cards never win.
 */
export function resolveTrickWinner(
  trick: Trick,
  trump: Suit | null,
  trumpRevealed: boolean,
): Card {
  if (trick.plays.length !== 4) {
    throw new Error('Trick must have 4 plays to resolve');
  }
  const leadSuit = trick.leadSuit ?? trick.plays[0]!.card.suit;
  const effectiveTrump = trumpRevealed && trump ? trump : null;

  let winning = trick.plays[0]!;

  for (let i = 1; i < trick.plays.length; i++) {
    const play = trick.plays[i]!;
    const card = play.card;
    const winCard = winning.card;

    if (effectiveTrump) {
      const cardIsTrump = card.suit === effectiveTrump;
      const winIsTrump = winCard.suit === effectiveTrump;

      if (cardIsTrump && !winIsTrump) {
        winning = play;
      } else if (cardIsTrump && winIsTrump) {
        if (card.rankStrength > winCard.rankStrength) winning = play;
      } else if (!cardIsTrump && !winIsTrump) {
        if (card.suit === leadSuit && winCard.suit === leadSuit) {
          if (card.rankStrength > winCard.rankStrength) winning = play;
        } else if (card.suit === leadSuit && winCard.suit !== leadSuit) {
          winning = play;
        }
      }
      // non-trump off-suit never beats trump or lead-suit
    } else {
      // No trump in effect: highest of lead suit wins
      if (card.suit === leadSuit && winCard.suit === leadSuit) {
        if (card.rankStrength > winCard.rankStrength) winning = play;
      } else if (card.suit === leadSuit && winCard.suit !== leadSuit) {
        winning = play;
      }
    }
  }

  return winning.card;
}

export function resolveTrickWinnerSeat(
  trick: Trick,
  trump: Suit | null,
  trumpRevealed: boolean,
): typeof trick.plays[0]['seat'] {
  const winCard = resolveTrickWinner(trick, trump, trumpRevealed);
  const play = trick.plays.find((p) => p.card.equals(winCard));
  if (!play) throw new Error('Winning card not found in trick');
  return play.seat;
}

/**
 * Legal cards a player may play from `hand` given current trick state.
 */
export function legalCards(
  hand: Card[],
  trick: Trick,
  trump: Suit | null,
  trumpRevealed: boolean,
  rules: RuleConfig,
): Card[] {
  if (hand.length === 0) return [];

  // Leading the trick — any card
  if (trick.plays.length === 0) {
    return [...hand];
  }

  const leadSuit = trick.leadSuit ?? trick.plays[0]!.card.suit;
  const inSuit = hand.filter((c) => c.suit === leadSuit);

  if (inSuit.length > 0) {
    return inSuit; // Must follow suit
  }

  // Cannot follow — any card (trump or discard)
  let candidates = [...hand];

  if (rules.undertrumpForbidden && trumpRevealed && trump) {
    const trumpsPlayed = trick.plays
      .filter((p) => p.card.suit === trump)
      .map((p) => p.card);
    if (trumpsPlayed.length > 0) {
      const highestTrumpOut = Math.max(...trumpsPlayed.map((c) => c.rankStrength));
      const myTrumps = hand.filter((c) => c.suit === trump);
      const overTrumps = myTrumps.filter((c) => c.rankStrength > highestTrumpOut);
      const nonTrumps = hand.filter((c) => c.suit !== trump);
      // Must overtrump if able; else may discard non-trump; undertrump forbidden
      if (overTrumps.length > 0) {
        candidates = [...overTrumps, ...nonTrumps];
      } else if (nonTrumps.length > 0) {
        candidates = nonTrumps;
      }
      // else only undertrumps left — must play them
    }
  }

  return candidates;
}
