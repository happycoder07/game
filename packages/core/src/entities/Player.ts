import { Card, type CardJSON } from './Card.js';
import { Seat } from './Seat.js';
import { Suit } from './Suit.js';
import { Rank } from './Rank.js';

export type PlayerKind = 'human' | 'ai';
export type AiLevel = 'easy' | 'medium' | 'hard';

export interface Player {
  id: string;
  name: string;
  seat: Seat;
  kind: PlayerKind;
  aiLevel?: AiLevel;
  hand: Card[];
  /** Connected for multiplayer; always true for local/AI. */
  connected: boolean;
}

export interface PlayerJSON {
  id: string;
  name: string;
  seat: Seat;
  kind: PlayerKind;
  aiLevel?: AiLevel;
  hand: CardJSON[];
  connected: boolean;
}

export function createPlayer(params: {
  id: string;
  name: string;
  seat: Seat;
  kind?: PlayerKind;
  aiLevel?: AiLevel;
}): Player {
  return {
    id: params.id,
    name: params.name,
    seat: params.seat,
    kind: params.kind ?? 'human',
    aiLevel: params.aiLevel,
    hand: [],
    connected: true,
  };
}

export function playerToJSON(p: Player): PlayerJSON {
  return {
    id: p.id,
    name: p.name,
    seat: p.seat,
    kind: p.kind,
    aiLevel: p.aiLevel,
    hand: p.hand.map((c) => c.toJSON()),
    connected: p.connected,
  };
}

export function playerFromJSON(json: PlayerJSON): Player {
  return {
    id: json.id,
    name: json.name,
    seat: json.seat,
    kind: json.kind,
    aiLevel: json.aiLevel,
    hand: json.hand.map(Card.fromJSON),
    connected: json.connected,
  };
}

export function sortHand(hand: Card[], trump?: Suit | null): Card[] {
  const suitOrder = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];
  return [...hand].sort((a, b) => {
    if (trump) {
      if (a.suit === trump && b.suit !== trump) return -1;
      if (b.suit === trump && a.suit !== trump) return 1;
    }
    const si = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    if (si !== 0) return si;
    return b.rankStrength - a.rankStrength;
  });
}

export function hasMarriage(hand: Card[], trump: Suit): boolean {
  const hasKing = hand.some((c) => c.suit === trump && c.rank === Rank.King);
  const hasQueen = hand.some((c) => c.suit === trump && c.rank === Rank.Queen);
  return hasKing && hasQueen;
}

export function cardsOfSuit(hand: Card[], suit: Suit): Card[] {
  return hand.filter((c) => c.suit === suit);
}
