/**
 * Seat positions around the table.
 * Partners sit opposite: North↔South, East↔West.
 */
export enum Seat {
  North = 'N',
  East = 'E',
  South = 'S',
  West = 'W',
}

export const ALL_SEATS: readonly Seat[] = [
  Seat.North,
  Seat.East,
  Seat.South,
  Seat.West,
] as const;

/** Clockwise order starting from North (dealer rotation / play order). */
export const CLOCKWISE: readonly Seat[] = [
  Seat.North,
  Seat.East,
  Seat.South,
  Seat.West,
] as const;

export function nextSeat(seat: Seat): Seat {
  const idx = CLOCKWISE.indexOf(seat);
  return CLOCKWISE[(idx + 1) % 4]!;
}

export function previousSeat(seat: Seat): Seat {
  const idx = CLOCKWISE.indexOf(seat);
  return CLOCKWISE[(idx + 3) % 4]!;
}

export function oppositeSeat(seat: Seat): Seat {
  switch (seat) {
    case Seat.North:
      return Seat.South;
    case Seat.South:
      return Seat.North;
    case Seat.East:
      return Seat.West;
    case Seat.West:
      return Seat.East;
  }
}

export function seatDisplayName(seat: Seat): string {
  switch (seat) {
    case Seat.North:
      return 'North';
    case Seat.East:
      return 'East';
    case Seat.South:
      return 'South';
    case Seat.West:
      return 'West';
  }
}
