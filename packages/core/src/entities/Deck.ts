import { Card } from './Card.js';
import { ALL_RANKS } from './Rank.js';
import { ALL_SUITS } from './Suit.js';

/**
 * 32-card Twenty-Nine deck (7–A in four suits).
 * Pure shuffle / deal helpers — no game logic.
 */
export class Deck {
  private cards: Card[];

  constructor(cards?: Card[]) {
    this.cards = cards ? [...cards] : Deck.createFullDeck();
  }

  static createFullDeck(): Card[] {
    const cards: Card[] = [];
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        cards.push(new Card(suit, rank));
      }
    }
    return cards;
  }

  get size(): number {
    return this.cards.length;
  }

  get remaining(): readonly Card[] {
    return this.cards;
  }

  /**
   * Fisher–Yates shuffle. Pass an optional RNG for deterministic tests.
   * @param rng — returns [0, 1)
   */
  shuffle(rng: () => number = Math.random): this {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = this.cards[i]!;
      this.cards[i] = this.cards[j]!;
      this.cards[j] = tmp;
    }
    return this;
  }

  /** Draw `n` cards from the top (front) of the deck. */
  deal(n: number): Card[] {
    if (n > this.cards.length) {
      throw new Error(`Cannot deal ${n} cards; only ${this.cards.length} remain`);
    }
    return this.cards.splice(0, n);
  }

  peek(n: number = 1): Card[] {
    return this.cards.slice(0, n);
  }

  clone(): Deck {
    return new Deck(this.cards.map((c) => new Card(c.suit, c.rank)));
  }

  toJSON(): { cards: ReturnType<Card['toJSON']>[] } {
    return { cards: this.cards.map((c) => c.toJSON()) };
  }

  static fromJSON(json: { cards: ReturnType<Card['toJSON']>[] }): Deck {
    return new Deck(json.cards.map(Card.fromJSON));
  }
}

/** Total card points in a full deck (excluding last-trick bonus). */
export const DECK_CARD_POINTS = 28;
/** Last trick bonus point. */
export const LAST_TRICK_BONUS = 1;
/** Total points available per round. */
export const TOTAL_ROUND_POINTS = DECK_CARD_POINTS + LAST_TRICK_BONUS; // 29
