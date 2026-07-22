import {
  Card,
  legalCards,
  GamePhase,
  Seat,
  type GameStateJSON,
  mergeRules,
  createTrick,
} from '@twenty-nine/core';

/** Derive legal card ids for a seat from a public/partial snapshot (online play). */
export function legalMovesFromSnapshot(snapshot: GameStateJSON, seat: Seat): string[] {
  if (snapshot.phase !== GamePhase.Playing || snapshot.toAct !== seat) return [];
  const hand = (snapshot.players[seat]?.hand ?? []).map(Card.fromJSON);
  const ct = snapshot.currentTrick;
  if (!ct) return [];
  const trick = createTrick(ct.index, ct.leader as Seat);
  trick.leadSuit = ct.leadSuit;
  trick.plays = ct.plays.map((p) => ({
    seat: p.seat as Seat,
    card: Card.fromJSON(p.card),
  }));
  return legalCards(
    hand,
    trick,
    snapshot.trump.suit,
    snapshot.trump.revealed,
    mergeRules(snapshot.rules),
  ).map((c) => c.id);
}

export function legalBidsFromSnapshot(snapshot: GameStateJSON, seat: Seat): number[] {
  if (snapshot.phase !== GamePhase.Bidding || snapshot.auction.toAct !== seat) return [];
  const min =
    snapshot.auction.currentBid === null
      ? snapshot.rules.minBid
      : snapshot.auction.currentBid + 1;
  const out: number[] = [];
  for (let v = min; v <= snapshot.rules.maxBid; v++) out.push(v);
  return out;
}
