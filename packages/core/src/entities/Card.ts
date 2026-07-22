import { Rank, POINT_VALUES, RANK_ORDER, rankDisplayName } from './Rank.js';
import { Suit, suitSymbol, suitDisplayName } from './Suit.js';

/**
 * Immutable playing card. Identity is suit+rank; comparisons use
 * official Twenty-Nine ranking when suits match (or trump applies).
 */
export class Card {
  constructor(
    public readonly suit: Suit,
    public readonly rank: Rank,
  ) {}

  /** Unique id e.g. "HJ", "S10" — stable for serialization & React keys. */
  get id(): string {
    return `${this.suit}${this.rank}`;
  }

  get pointValue(): number {
    return POINT_VALUES[this.rank];
  }

  get rankStrength(): number {
    return RANK_ORDER[this.rank];
  }

  equals(other: Card): boolean {
    return this.suit === other.suit && this.rank === other.rank;
  }

  toString(): string {
    return `${rankDisplayName(this.rank)}${suitSymbol(this.suit)}`;
  }

  toLongString(): string {
    return `${rankDisplayName(this.rank)} of ${suitDisplayName(this.suit)}`;
  }

  toJSON(): CardJSON {
    return { suit: this.suit, rank: this.rank };
  }

  static fromJSON(json: CardJSON): Card {
    return new Card(json.suit, json.rank);
  }

  static fromId(id: string): Card {
    // Suit is always 1 char; rank is rest (A, K, Q, J, 10, 9, 8, 7)
    const suit = id[0] as Suit;
    const rank = id.slice(1) as Rank;
    return new Card(suit, rank);
  }
}

export interface CardJSON {
  suit: Suit;
  rank: Rank;
}

/** Compare two cards of the same suit by official rank order. */
export function compareSameSuit(a: Card, b: Card): number {
  return a.rankStrength - b.rankStrength;
}
