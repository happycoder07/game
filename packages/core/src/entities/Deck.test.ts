import { describe, it, expect } from 'vitest';
import {
  Deck,
  Card,
  Rank,
  Suit,
  POINT_VALUES,
  RANK_ORDER,
  DECK_CARD_POINTS,
  TOTAL_ROUND_POINTS,
  ALL_RANKS,
  ALL_SUITS,
} from '../index.js';

describe('Deck', () => {
  it('has 32 cards', () => {
    expect(new Deck().size).toBe(32);
  });

  it('contains each suit×rank once', () => {
    const ids = new Deck().remaining.map((c) => c.id);
    expect(new Set(ids).size).toBe(32);
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        expect(ids).toContain(`${suit}${rank}`);
      }
    }
  });

  it('shuffles deterministically with seeded rng', () => {
    let s = 1;
    const rng = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    const a = new Deck().shuffle(rng).remaining.map((c) => c.id);
    s = 1;
    const b = new Deck().shuffle(rng).remaining.map((c) => c.id);
    expect(a).toEqual(b);
  });

  it('deal reduces size', () => {
    const d = new Deck();
    const hand = d.deal(4);
    expect(hand).toHaveLength(4);
    expect(d.size).toBe(28);
  });
});

describe('Point values', () => {
  it('sums to 28 card points', () => {
    const total = new Deck().remaining.reduce((s, c) => s + c.pointValue, 0);
    expect(total).toBe(DECK_CARD_POINTS);
    expect(TOTAL_ROUND_POINTS).toBe(29);
  });

  it('matches official values', () => {
    expect(POINT_VALUES[Rank.Jack]).toBe(3);
    expect(POINT_VALUES[Rank.Nine]).toBe(2);
    expect(POINT_VALUES[Rank.Ace]).toBe(1);
    expect(POINT_VALUES[Rank.Ten]).toBe(1);
    expect(POINT_VALUES[Rank.King]).toBe(0);
    expect(POINT_VALUES[Rank.Queen]).toBe(0);
  });
});

describe('Card ranking', () => {
  it('orders J > 9 > A > 10 > K > Q > 8 > 7', () => {
    const order = [
      Rank.Jack,
      Rank.Nine,
      Rank.Ace,
      Rank.Ten,
      Rank.King,
      Rank.Queen,
      Rank.Eight,
      Rank.Seven,
    ];
    for (let i = 0; i < order.length - 1; i++) {
      expect(RANK_ORDER[order[i]!]).toBeGreaterThan(RANK_ORDER[order[i + 1]!]);
    }
  });

  it('serializes by id', () => {
    const c = new Card(Suit.Hearts, Rank.Jack);
    expect(c.id).toBe('HJ');
    expect(Card.fromId('HJ').equals(c)).toBe(true);
  });
});
