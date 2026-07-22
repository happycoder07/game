/**
 * Rank — only A, K, Q, J, 10, 9, 8, 7 are used (32-card deck).
 *
 * Official Twenty-Nine trick ranking (high → low), identical for
 * trump and non-trump suits:
 *   J > 9 > A > 10 > K > Q > 8 > 7
 */
export enum Rank {
  Ace = 'A',
  King = 'K',
  Queen = 'Q',
  Jack = 'J',
  Ten = '10',
  Nine = '9',
  Eight = '8',
  Seven = '7',
}

export const ALL_RANKS: readonly Rank[] = [
  Rank.Ace,
  Rank.King,
  Rank.Queen,
  Rank.Jack,
  Rank.Ten,
  Rank.Nine,
  Rank.Eight,
  Rank.Seven,
] as const;

/**
 * Trick-taking strength: higher number beats lower within the same suit.
 * Applies equally to trump and plain suits in official 29 rules.
 */
export const RANK_ORDER: Readonly<Record<Rank, number>> = {
  [Rank.Jack]: 8,
  [Rank.Nine]: 7,
  [Rank.Ace]: 6,
  [Rank.Ten]: 5,
  [Rank.King]: 4,
  [Rank.Queen]: 3,
  [Rank.Eight]: 2,
  [Rank.Seven]: 1,
};

/**
 * Card-point values. Sum of all cards = 28; last trick adds +1 → 29.
 */
export const POINT_VALUES: Readonly<Record<Rank, number>> = {
  [Rank.Jack]: 3,
  [Rank.Nine]: 2,
  [Rank.Ace]: 1,
  [Rank.Ten]: 1,
  [Rank.King]: 0,
  [Rank.Queen]: 0,
  [Rank.Eight]: 0,
  [Rank.Seven]: 0,
};

export function rankDisplayName(rank: Rank): string {
  switch (rank) {
    case Rank.Ace:
      return 'Ace';
    case Rank.King:
      return 'King';
    case Rank.Queen:
      return 'Queen';
    case Rank.Jack:
      return 'Jack';
    case Rank.Ten:
      return '10';
    case Rank.Nine:
      return '9';
    case Rank.Eight:
      return '8';
    case Rank.Seven:
      return '7';
  }
}
