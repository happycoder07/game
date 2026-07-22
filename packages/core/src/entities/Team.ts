/**
 * Teams are fixed partnerships.
 * TeamNS = North + South, TeamEW = East + West.
 */
export enum TeamId {
  NS = 'NS',
  EW = 'EW',
}

import { Seat, oppositeSeat } from './Seat.js';

export function teamForSeat(seat: Seat): TeamId {
  return seat === Seat.North || seat === Seat.South ? TeamId.NS : TeamId.EW;
}

export function partnerOf(seat: Seat): Seat {
  return oppositeSeat(seat);
}

export function seatsOfTeam(team: TeamId): [Seat, Seat] {
  return team === TeamId.NS ? [Seat.North, Seat.South] : [Seat.East, Seat.West];
}

export function opposingTeam(team: TeamId): TeamId {
  return team === TeamId.NS ? TeamId.EW : TeamId.NS;
}

export interface TeamScore {
  teamId: TeamId;
  /** Card points captured this round (including last-trick bonus if won). */
  roundCardPoints: number;
  /** Cumulative game points (±). */
  gamePoints: number;
}

export function createEmptyTeamScore(teamId: TeamId): TeamScore {
  return { teamId, roundCardPoints: 0, gamePoints: 0 };
}
