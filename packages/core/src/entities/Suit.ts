/**
 * Suit — the four French suits used in Twenty-Nine.
 * Spades/Hearts/Diamonds/Clubs; no jokers.
 */
export enum Suit {
  Spades = 'S',
  Hearts = 'H',
  Diamonds = 'D',
  Clubs = 'C',
}

export const ALL_SUITS: readonly Suit[] = [
  Suit.Spades,
  Suit.Hearts,
  Suit.Diamonds,
  Suit.Clubs,
] as const;

export function suitDisplayName(suit: Suit): string {
  switch (suit) {
    case Suit.Spades:
      return 'Spades';
    case Suit.Hearts:
      return 'Hearts';
    case Suit.Diamonds:
      return 'Diamonds';
    case Suit.Clubs:
      return 'Clubs';
  }
}

export function suitSymbol(suit: Suit): string {
  switch (suit) {
    case Suit.Spades:
      return '♠';
    case Suit.Hearts:
      return '♥';
    case Suit.Diamonds:
      return '♦';
    case Suit.Clubs:
      return '♣';
  }
}

export function isRedSuit(suit: Suit): boolean {
  return suit === Suit.Hearts || suit === Suit.Diamonds;
}
