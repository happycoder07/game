import { describe, it, expect } from 'vitest';
import {
  createTrick,
  Card,
  Rank,
  Suit,
  Seat,
  resolveTrickWinnerSeat,
  legalCards,
  DEFAULT_RULES,
} from '../index.js';

function play(
  trick: ReturnType<typeof createTrick>,
  seat: Seat,
  suit: Suit,
  rank: Rank,
) {
  const card = new Card(suit, rank);
  if (trick.plays.length === 0) trick.leadSuit = suit;
  trick.plays.push({ seat, card });
}

describe('Trick winner', () => {
  it('highest of lead suit wins without trump', () => {
    const t = createTrick(0, Seat.North);
    play(t, Seat.North, Suit.Spades, Rank.Ace);
    play(t, Seat.East, Suit.Spades, Rank.King);
    play(t, Seat.South, Suit.Spades, Rank.Jack);
    play(t, Seat.West, Suit.Hearts, Rank.Nine);
    expect(resolveTrickWinnerSeat(t, null, false)).toBe(Seat.South); // J > A
  });

  it('trump beats higher lead-suit card', () => {
    const t = createTrick(0, Seat.North);
    play(t, Seat.North, Suit.Spades, Rank.Jack);
    play(t, Seat.East, Suit.Hearts, Rank.Seven); // trump
    play(t, Seat.South, Suit.Spades, Rank.Nine);
    play(t, Seat.West, Suit.Spades, Rank.Ace);
    expect(resolveTrickWinnerSeat(t, Suit.Hearts, true)).toBe(Seat.East);
  });

  it('higher trump beats lower trump', () => {
    const t = createTrick(0, Seat.North);
    play(t, Seat.North, Suit.Clubs, Rank.Ace);
    play(t, Seat.East, Suit.Hearts, Rank.Queen);
    play(t, Seat.South, Suit.Hearts, Rank.Jack);
    play(t, Seat.West, Suit.Clubs, Rank.Ten);
    expect(resolveTrickWinnerSeat(t, Suit.Hearts, true)).toBe(Seat.South);
  });

  it('off-suit non-trump never wins', () => {
    const t = createTrick(0, Seat.North);
    play(t, Seat.North, Suit.Spades, Rank.Seven);
    play(t, Seat.East, Suit.Diamonds, Rank.Jack);
    play(t, Seat.South, Suit.Clubs, Rank.Jack);
    play(t, Seat.West, Suit.Diamonds, Rank.Nine);
    expect(resolveTrickWinnerSeat(t, Suit.Hearts, true)).toBe(Seat.North);
  });
});

describe('Legal cards', () => {
  it('must follow suit when able', () => {
    const hand = [
      new Card(Suit.Spades, Rank.Ace),
      new Card(Suit.Hearts, Rank.Jack),
      new Card(Suit.Clubs, Rank.Nine),
    ];
    const t = createTrick(0, Seat.North);
    play(t, Seat.North, Suit.Hearts, Rank.Seven);
    const legal = legalCards(hand, t, Suit.Clubs, true, DEFAULT_RULES);
    expect(legal).toHaveLength(1);
    expect(legal[0]!.id).toBe('HJ');
  });

  it('any card when cannot follow', () => {
    const hand = [
      new Card(Suit.Spades, Rank.Ace),
      new Card(Suit.Clubs, Rank.Nine),
    ];
    const t = createTrick(0, Seat.North);
    play(t, Seat.North, Suit.Hearts, Rank.Seven);
    const legal = legalCards(hand, t, Suit.Diamonds, true, DEFAULT_RULES);
    expect(legal).toHaveLength(2);
  });
});
