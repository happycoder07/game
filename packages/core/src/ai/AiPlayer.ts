import { Card } from '../entities/Card.js';
import { Rank } from '../entities/Rank.js';
import { Suit } from '../entities/Suit.js';
import type { Seat } from '../entities/Seat.js';
import { teamForSeat, TeamId } from '../entities/Team.js';
import type { GameState } from '../engine/GameState.js';
import { getAdjustedTarget } from '../engine/GameState.js';
import { GamePhase } from '../fsm/GamePhase.js';
import { hasMarriage } from '../entities/Player.js';
import { pickRandom, createSeededRng } from '../engine/rng.js';
import type { AiLevel } from '../entities/Player.js';
import { ALL_SUITS } from '../entities/Suit.js';
import { GameEngine } from '../engine/GameEngine.js';

export interface AiDecision {
  command:
    | 'bid'
    | 'pass'
    | 'chooseTrump'
    | 'playCard'
    | 'revealTrump'
    | 'declareMarriage'
    | 'double'
    | 'redouble'
    | 'passChallenge'
    | 'startRound';
  value?: number;
  suit?: Suit;
  cardId?: string;
}

/**
 * Easy AI — uniform random among legal actions.
 */
export function decideEasy(engine: GameEngine, seat: Seat, rng = Math.random): AiDecision {
  const state = engine.getState();
  switch (state.phase) {
    case GamePhase.Bidding: {
      const legal = engine.getLegalBids(seat);
      // 50% pass if someone has bid, else always bid something
      if (state.auction.currentBid !== null && rng() < 0.55) {
        return { command: 'pass' };
      }
      if (legal.length === 0) return { command: 'pass' };
      return { command: 'bid', value: pickRandom(rng, legal) };
    }
    case GamePhase.TrumpSelection: {
      const hand = state.players[seat].hand;
      const suit = pickBestTrumpSuit(hand, rng);
      return { command: 'chooseTrump', suit };
    }
    case GamePhase.Challenge:
      return { command: 'passChallenge' };
    case GamePhase.Playing: {
      if (
        state.rules.allowVoluntaryReveal &&
        !state.trump.revealed &&
        state.toAct === seat &&
        rng() < 0.05
      ) {
        return { command: 'revealTrump' };
      }
      const legal = engine.getLegalMoves(seat);
      if (legal.length === 0) throw new Error('No legal moves');
      return { command: 'playCard', cardId: pickRandom(rng, legal) };
    }
    case GamePhase.RoundEnd:
    case GamePhase.Waiting:
      return { command: 'startRound' };
    default:
      return { command: 'pass' };
  }
}

/**
 * Medium AI — heuristic rules:
 * - Bid based on high-card points in first 4
 * - Choose trump as longest/strongest suit
 * - Play: follow with lowest loser, or dump low; trump when winning is likely
 * - Preserve point cards when losing the trick
 */
export function decideMedium(engine: GameEngine, seat: Seat, rng = Math.random): AiDecision {
  const state = engine.getState();
  switch (state.phase) {
    case GamePhase.Bidding: {
      const hand = state.players[seat].hand;
      const strength = estimateHandStrength(hand);
      const legal = engine.getLegalBids(seat);
      if (legal.length === 0) return { command: 'pass' };

      const target = Math.min(
        state.rules.maxBid,
        Math.max(state.rules.minBid, Math.floor(strength)),
      );
      const current = state.auction.currentBid;

      if (current === null) {
        // Open at minBid whenever hand has reasonable strength
        if (strength >= 10) {
          return { command: 'bid', value: legal[0]! };
        }
        return { command: 'pass' };
      }
      const raiseCandidates = legal.filter((v) => v <= target);
      if (raiseCandidates.length > 0 && strength >= current + 2) {
        return { command: 'bid', value: raiseCandidates[0]! };
      }
      return { command: 'pass' };
    }
    case GamePhase.TrumpSelection:
      return { command: 'chooseTrump', suit: pickBestTrumpSuit(state.players[seat].hand, rng) };
    case GamePhase.Challenge: {
      // Double if defenders and bidder looks weak (high bid, we have points)
      if (
        state.rules.allowDouble &&
        !state.challenge.doubled &&
        state.contractTeam &&
        teamForSeat(seat) !== state.contractTeam &&
        (state.contractBid ?? 0) >= 20
      ) {
        const pts = estimateHandStrength(state.players[seat].hand);
        if (pts >= 10 && rng() < 0.4) return { command: 'double' };
      }
      if (
        state.challenge.doubled &&
        !state.challenge.redoubled &&
        state.contractTeam &&
        teamForSeat(seat) === state.contractTeam &&
        state.rules.allowRedouble
      ) {
        if (rng() < 0.15) return { command: 'redouble' };
      }
      return { command: 'passChallenge' };
    }
    case GamePhase.Playing:
      return decidePlayMedium(engine, seat, rng);
    case GamePhase.RoundEnd:
    case GamePhase.Waiting:
      return { command: 'startRound' };
    default:
      return { command: 'pass' };
  }
}

function decidePlayMedium(engine: GameEngine, seat: Seat, _rng: () => number): AiDecision {
  const state = engine.getState();
  const hand = state.players[seat].hand;
  const trump = state.trump.suit;
  const revealed = state.trump.revealed;

  // Declare marriage when possible
  if (
    revealed &&
    trump &&
    hasMarriage(hand, trump) &&
    !state.marriage.declarations.some((d) => d.team === teamForSeat(seat))
  ) {
    const partnerOk =
      !state.rules.marriageRequiresWonTrick ||
      state.tricksWonSinceReveal.some((s) => teamForSeat(s) === teamForSeat(seat));
    if (partnerOk) {
      return { command: 'declareMarriage' };
    }
  }

  const legalIds = engine.getLegalMoves(seat);
  const legal = legalIds.map((id) => Card.fromId(id));
  const trick = state.currentTrick!;

  if (trick.plays.length === 0) {
    // Lead: prefer non-trump low, or trump jack if strong
    const nonTrump = trump ? legal.filter((c) => c.suit !== trump) : legal;
    const pool = nonTrump.length > 0 ? nonTrump : legal;
    const sorted = [...pool].sort((a, b) => a.rankStrength - b.rankStrength);
    // Lead jack of a suit if we have it
    const jack = pool.find((c) => c.rank === Rank.Jack);
    if (jack) return { command: 'playCard', cardId: jack.id };
    return { command: 'playCard', cardId: sorted[0]!.id };
  }

  const currentWinner = estimateCurrentWinner(state);
  const weAreWinning =
    currentWinner !== null && teamForSeat(currentWinner) === teamForSeat(seat);
  const partnerWinning =
    currentWinner !== null &&
    teamForSeat(currentWinner) === teamForSeat(seat) &&
    currentWinner !== seat;

  if (weAreWinning || partnerWinning) {
    // Dump lowest point card / lowest card
    const sorted = [...legal].sort((a, b) => {
      if (a.pointValue !== b.pointValue) return a.pointValue - b.pointValue;
      return a.rankStrength - b.rankStrength;
    });
    return { command: 'playCard', cardId: sorted[0]!.id };
  }

  // Try to win with cheapest winner
  const winners = legal.filter((c) => wouldWinTrick(state, c));
  if (winners.length > 0) {
    winners.sort((a, b) => a.rankStrength - b.rankStrength);
    return { command: 'playCard', cardId: winners[0]!.id };
  }

  // Can't win — dump lowest points
  const sorted = [...legal].sort((a, b) => {
    if (a.pointValue !== b.pointValue) return a.pointValue - b.pointValue;
    return a.rankStrength - b.rankStrength;
  });
  return { command: 'playCard', cardId: sorted[0]!.id };
}

/**
 * Hard AI — card counting, trump estimation, partner inference, bid EV.
 */
export function decideHard(engine: GameEngine, seat: Seat, rng = Math.random): AiDecision {
  const state = engine.getState();

  switch (state.phase) {
    case GamePhase.Bidding: {
      const hand = state.players[seat].hand;
      const est = estimateHandStrength(hand) + estimateSuitControl(hand);
      const legal = engine.getLegalBids(seat);
      if (legal.length === 0) return { command: 'pass' };
      const current = state.auction.currentBid;
      const aggressive = Math.floor(est);
      if (current === null) {
        if (aggressive >= state.rules.minBid) {
          return { command: 'bid', value: state.rules.minBid };
        }
        return aggressive >= 13 ? { command: 'bid', value: state.rules.minBid } : { command: 'pass' };
      }
      if (aggressive > current && legal[0]! <= aggressive) {
        // Bid minimum raise only if EV positive
        if (aggressive >= current + 1) return { command: 'bid', value: legal[0]! };
      }
      return { command: 'pass' };
    }
    case GamePhase.TrumpSelection: {
      return { command: 'chooseTrump', suit: pickBestTrumpSuit(state.players[seat].hand, rng) };
    }
    case GamePhase.Challenge: {
      const med = decideMedium(engine, seat, rng);
      return med;
    }
    case GamePhase.Playing:
      return decidePlayHard(engine, seat, rng);
    case GamePhase.RoundEnd:
    case GamePhase.Waiting:
      return { command: 'startRound' };
    default:
      return { command: 'pass' };
  }
}

function decidePlayHard(engine: GameEngine, seat: Seat, rng: () => number): AiDecision {
  const state = engine.getState();
  const hand = state.players[seat].hand;
  const trump = state.trump.suit;
  const revealed = state.trump.revealed;
  const tracking = buildCardTracking(state, seat);

  // Strategic reveal: reveal when we want to trump a fat trick and can't follow
  if (
    !revealed &&
    trump &&
    state.rules.allowVoluntaryReveal &&
    state.toAct === seat &&
    state.currentTrick &&
    state.currentTrick.plays.length > 0
  ) {
    const lead = state.currentTrick.leadSuit!;
    const canFollow = hand.some((c) => c.suit === lead);
    if (!canFollow) {
      const trickPts = state.currentTrick.plays.reduce((s, p) => s + p.card.pointValue, 0);
      const myTrumps = hand.filter((c) => c.suit === trump);
      if (trickPts >= 3 && myTrumps.length > 0) {
        return { command: 'revealTrump' };
      }
    }
  }

  // Marriage
  if (revealed && trump && hasMarriage(hand, trump)) {
    const team = teamForSeat(seat);
    if (!state.marriage.declarations.some((d) => d.team === team)) {
      const ok =
        !state.rules.marriageRequiresWonTrick ||
        state.tricksWonSinceReveal.some((s) => teamForSeat(s) === team);
      if (ok) return { command: 'declareMarriage' };
    }
  }

  const legalIds = engine.getLegalMoves(seat);
  const legal = legalIds.map((id) => Card.fromId(id));
  const trick = state.currentTrick!;

  // Endgame: if we are bidding team, count needed points
  const target = getAdjustedTarget(state);
  const ourTeam = teamForSeat(seat);
  const ourPoints = ourTeam === TeamId.NS ? state.pointsNS : state.pointsEW;
  const isBidder = state.contractTeam === ourTeam;
  const need = target !== null && isBidder ? Math.max(0, target - ourPoints) : null;

  if (trick.plays.length === 0) {
    return { command: 'playCard', cardId: chooseLeadHard(legal, trump, revealed, tracking, need).id };
  }

  const currentWinner = estimateCurrentWinner(state);
  const partnerWinning =
    currentWinner !== null && teamForSeat(currentWinner) === ourTeam;

  if (partnerWinning) {
    // Feed points to partner if safe
    const sorted = [...legal].sort((a, b) => b.pointValue - a.pointValue || a.rankStrength - b.rankStrength);
    // Only feed if partner's card is likely to hold
    if (sorted[0]!.pointValue > 0 && isPartnerLikelyToHold(state, tracking)) {
      return { command: 'playCard', cardId: sorted[0]!.id };
    }
    const dump = [...legal].sort((a, b) => a.pointValue - b.pointValue || a.rankStrength - b.rankStrength);
    return { command: 'playCard', cardId: dump[0]!.id };
  }

  const winners = legal.filter((c) => wouldWinTrick(state, c));
  if (winners.length > 0) {
    // Win with cheapest; prefer taking points if we need them
    winners.sort((a, b) => {
      if (need !== null && need > 0) {
        // Prefer higher point capture when we need points — but card points are in trick already
        return a.rankStrength - b.rankStrength;
      }
      return a.rankStrength - b.rankStrength;
    });
    return { command: 'playCard', cardId: winners[0]!.id };
  }

  // Sacrifice: dump lowest points
  const dump = [...legal].sort((a, b) => a.pointValue - b.pointValue || a.rankStrength - b.rankStrength);
  void rng;
  return { command: 'playCard', cardId: dump[0]!.id };
}

// ─── Shared heuristics ───────────────────────────────────────

export function estimateHandStrength(hand: Card[]): number {
  let pts = hand.reduce((s, c) => s + c.pointValue, 0);
  // Bonus for jacks and suit length
  const bySuit = new Map<Suit, Card[]>();
  for (const c of hand) {
    const arr = bySuit.get(c.suit) ?? [];
    arr.push(c);
    bySuit.set(c.suit, arr);
  }
  for (const cards of bySuit.values()) {
    if (cards.length >= 3) pts += 1.5;
    if (cards.some((c) => c.rank === Rank.Jack)) pts += 1;
    if (cards.some((c) => c.rank === Rank.Nine)) pts += 0.5;
  }
  return pts;
}

function estimateSuitControl(hand: Card[]): number {
  let bonus = 0;
  for (const suit of ALL_SUITS) {
    const cards = hand.filter((c) => c.suit === suit);
    if (cards.some((c) => c.rank === Rank.Jack) && cards.length >= 2) bonus += 1.5;
  }
  return bonus;
}

export function pickBestTrumpSuit(hand: Card[], rng: () => number = Math.random): Suit {
  let best = ALL_SUITS[0]!;
  let bestScore = -Infinity;
  for (const suit of ALL_SUITS) {
    const cards = hand.filter((c) => c.suit === suit);
    let score = cards.length * 3;
    score += cards.reduce((s, c) => s + c.pointValue * 2 + c.rankStrength * 0.1, 0);
    if (cards.some((c) => c.rank === Rank.Jack)) score += 5;
    if (cards.some((c) => c.rank === Rank.King) && cards.some((c) => c.rank === Rank.Queen)) {
      score += 4; // marriage potential
    }
    score += rng() * 0.01; // tiny tiebreak
    if (score > bestScore) {
      bestScore = score;
      best = suit;
    }
  }
  return best;
}

function estimateCurrentWinner(state: GameState): Seat | null {
  const trick = state.currentTrick;
  if (!trick || trick.plays.length === 0) return null;
  // Reuse resolver by building a partial comparison
  const trump = state.trump.revealed ? state.trump.suit : null;
  const leadSuit = trick.leadSuit!;
  let best = trick.plays[0]!;
  for (let i = 1; i < trick.plays.length; i++) {
    const p = trick.plays[i]!;
    const c = p.card;
    const w = best.card;
    if (trump) {
      if (c.suit === trump && w.suit !== trump) best = p;
      else if (c.suit === trump && w.suit === trump && c.rankStrength > w.rankStrength) best = p;
      else if (c.suit !== trump && w.suit !== trump) {
        if (c.suit === leadSuit && (w.suit !== leadSuit || c.rankStrength > w.rankStrength)) best = p;
      }
    } else {
      if (c.suit === leadSuit && (w.suit !== leadSuit || c.rankStrength > w.rankStrength)) best = p;
    }
  }
  return best.seat;
}

function wouldWinTrick(state: GameState, card: Card): boolean {
  const trick = state.currentTrick!;
  const trump = state.trump.revealed ? state.trump.suit : null;
  const leadSuit = trick.leadSuit ?? card.suit;
  // Compare against current winner only (incomplete trick — still useful)
  if (trick.plays.length === 0) return true;
  const current = estimateCurrentWinner(state);
  if (!current) return true;
  const winCard = trick.plays.find((p) => p.seat === current)!.card;

  if (trump) {
    if (card.suit === trump && winCard.suit !== trump) return true;
    if (card.suit === trump && winCard.suit === trump) return card.rankStrength > winCard.rankStrength;
    if (card.suit !== trump && winCard.suit === trump) return false;
    if (card.suit === leadSuit && winCard.suit === leadSuit) return card.rankStrength > winCard.rankStrength;
    if (card.suit === leadSuit && winCard.suit !== leadSuit && winCard.suit !== trump) return true;
    return false;
  }
  if (card.suit === leadSuit && winCard.suit === leadSuit) return card.rankStrength > winCard.rankStrength;
  if (card.suit === leadSuit && winCard.suit !== leadSuit) return true;
  return false;
}

interface CardTracking {
  played: Set<string>;
  remainingBySuit: Record<Suit, number>;
}

function buildCardTracking(state: GameState, _seat: Seat): CardTracking {
  const played = new Set<string>();
  for (const t of state.tricks) {
    for (const p of t.plays) played.add(p.card.id);
  }
  if (state.currentTrick) {
    for (const p of state.currentTrick.plays) played.add(p.card.id);
  }
  const remainingBySuit = {} as Record<Suit, number>;
  for (const suit of ALL_SUITS) {
    remainingBySuit[suit] = 8 - [...played].filter((id) => id.startsWith(suit)).length;
  }
  return { played, remainingBySuit };
}

function chooseLeadHard(
  legal: Card[],
  trump: Suit | null,
  revealed: boolean,
  tracking: CardTracking,
  need: number | null,
): Card {
  // Lead from long suits; avoid leading trump early unless needed
  const nonTrump = trump && revealed ? legal.filter((c) => c.suit !== trump) : legal;
  const pool = nonTrump.length > 0 ? nonTrump : legal;
  // Lead jack if suit still has cards out
  const jacks = pool.filter((c) => c.rank === Rank.Jack);
  if (jacks.length > 0) {
    jacks.sort(
      (a, b) => (tracking.remainingBySuit[b.suit] ?? 0) - (tracking.remainingBySuit[a.suit] ?? 0),
    );
    return jacks[0]!;
  }
  if (need !== null && need > 0 && trump) {
    const trumps = legal.filter((c) => c.suit === trump);
    if (trumps.length > 0) {
      trumps.sort((a, b) => b.rankStrength - a.rankStrength);
      return trumps[0]!;
    }
  }
  return [...pool].sort((a, b) => a.pointValue - b.pointValue || a.rankStrength - b.rankStrength)[0]!;
}

function isPartnerLikelyToHold(state: GameState, _tracking: CardTracking): boolean {
  const trick = state.currentTrick!;
  if (trick.plays.length === 0) return false;
  const winner = estimateCurrentWinner(state);
  if (!winner) return false;
  // If partner played trump jack / high trump, likely holds
  const play = trick.plays.find((p) => p.seat === winner);
  if (!play) return false;
  if (state.trump.revealed && play.card.suit === state.trump.suit && play.card.rankStrength >= 7) {
    return true;
  }
  if (play.card.rank === Rank.Jack) return true;
  return trick.plays.length >= 3; // last to play — already winning
}

export function decide(
  level: AiLevel,
  engine: GameEngine,
  seat: Seat,
  seed?: number,
): AiDecision {
  const rng = seed !== undefined ? createSeededRng(seed) : Math.random;
  switch (level) {
    case 'easy':
      return decideEasy(engine, seat, rng);
    case 'medium':
      return decideMedium(engine, seat, rng);
    case 'hard':
      return decideHard(engine, seat, rng);
  }
}

/** Apply an AI decision to the engine. */
export function applyAiDecision(engine: GameEngine, seat: Seat, decision: AiDecision): void {
  switch (decision.command) {
    case 'bid':
      engine.bid(seat, decision.value!);
      break;
    case 'pass':
      engine.pass(seat);
      break;
    case 'chooseTrump':
      engine.chooseTrump(seat, decision.suit!);
      break;
    case 'playCard':
      engine.playCard(seat, decision.cardId!);
      break;
    case 'revealTrump':
      engine.revealTrump(seat, 'voluntary');
      break;
    case 'declareMarriage':
      engine.declareMarriage(seat);
      break;
    case 'double':
      engine.double(seat);
      break;
    case 'redouble':
      engine.redouble(seat);
      break;
    case 'passChallenge':
      engine.passChallenge(seat);
      break;
    case 'startRound':
      engine.startRound();
      break;
  }
}

/**
 * Advance the game by running AI for whoever is to act,
 * until a human must act or the game is in a terminal waiting state.
 */
export function runAiUntilHuman(
  engine: GameEngine,
  isHuman: (seat: Seat) => boolean,
  maxSteps = 500,
): void {
  for (let i = 0; i < maxSteps; i++) {
    const state = engine.getState();
    if (state.phase === GamePhase.Finished) return;
    if (state.phase === GamePhase.Scoring) return;

    if (state.phase === GamePhase.RoundEnd || state.phase === GamePhase.Waiting) {
      // Auto-start if all AI, else let caller start
      const allAi = Object.values(state.players).every((p) => p.kind === 'ai');
      if (allAi) {
        engine.startRound();
        continue;
      }
      return;
    }

    let actor: Seat | null = null;
    if (state.phase === GamePhase.Bidding) actor = state.auction.toAct;
    else if (state.phase === GamePhase.TrumpSelection) actor = state.contractBidder;
    else if (state.phase === GamePhase.Challenge) {
      // If doubled and waiting redouble — bidder; else a defender
      actor = state.toAct;
    } else if (state.phase === GamePhase.Playing) actor = state.toAct;

    if (!actor) return;
    if (isHuman(actor)) return;

    const level = state.players[actor].aiLevel ?? 'medium';
    const decision = decide(level, engine, actor);
    applyAiDecision(engine, actor, decision);
  }
}
