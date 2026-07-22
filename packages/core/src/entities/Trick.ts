import { Card, type CardJSON } from './Card.js';
import { Seat } from './Seat.js';
import { Suit } from './Suit.js';
import { TeamId, teamForSeat } from './Team.js';

export interface TrickPlay {
  seat: Seat;
  card: Card;
}

export interface TrickPlayJSON {
  seat: Seat;
  card: CardJSON;
}

export interface Trick {
  /** 0-based trick index within the round (0..7). */
  index: number;
  leader: Seat;
  plays: TrickPlay[];
  /** Set when trick is complete (4 plays). */
  winner?: Seat;
  leadSuit?: Suit;
  cardPoints?: number;
}

export interface TrickJSON {
  index: number;
  leader: Seat;
  plays: TrickPlayJSON[];
  winner?: Seat;
  leadSuit?: Suit;
  cardPoints?: number;
}

export function createTrick(index: number, leader: Seat): Trick {
  return { index, leader, plays: [] };
}

export function trickCardPoints(trick: Trick): number {
  return trick.plays.reduce((sum, p) => sum + p.card.pointValue, 0);
}

export function trickWinningTeam(trick: Trick): TeamId | null {
  return trick.winner ? teamForSeat(trick.winner) : null;
}

export function trickToJSON(t: Trick): TrickJSON {
  return {
    index: t.index,
    leader: t.leader,
    plays: t.plays.map((p) => ({ seat: p.seat, card: p.card.toJSON() })),
    winner: t.winner,
    leadSuit: t.leadSuit,
    cardPoints: t.cardPoints,
  };
}

export function trickFromJSON(json: TrickJSON): Trick {
  return {
    index: json.index,
    leader: json.leader,
    plays: json.plays.map((p) => ({ seat: p.seat, card: Card.fromJSON(p.card) })),
    winner: json.winner,
    leadSuit: json.leadSuit,
    cardPoints: json.cardPoints,
  };
}
