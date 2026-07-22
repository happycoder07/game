import { Deck } from '../entities/Deck.js';
import type { Player, PlayerJSON } from '../entities/Player.js';
import { playerFromJSON, playerToJSON } from '../entities/Player.js';
import type { AuctionState } from '../entities/Bid.js';
import { createEmptyAuction } from '../entities/Bid.js';
import type { Trick } from '../entities/Trick.js';
import { trickFromJSON, trickToJSON, type TrickJSON } from '../entities/Trick.js';
import type { TrumpState } from '../entities/Trump.js';
import { createEmptyTrump } from '../entities/Trump.js';
import type { MarriageState } from '../entities/Marriage.js';
import { createEmptyMarriage } from '../entities/Marriage.js';
import type { GameScoreboard } from '../entities/Score.js';
import { createEmptyScoreboard } from '../entities/Score.js';
import { Seat, nextSeat } from '../entities/Seat.js';
import { TeamId } from '../entities/Team.js';
import { GamePhase } from '../fsm/GamePhase.js';
import type { RuleConfig } from '../rules/RuleConfig.js';
import { mergeRules } from '../rules/RuleConfig.js';
import { Card } from '../entities/Card.js';
import type { Suit } from '../entities/Suit.js';

export interface ChallengeState {
  doubled: boolean;
  redoubled: boolean;
  doubledBy: Seat | null;
  redoubledBy: Seat | null;
  /** Seats that have responded (pass on challenge). */
  resolved: boolean;
}

export function createEmptyChallenge(): ChallengeState {
  return {
    doubled: false,
    redoubled: false,
    doubledBy: null,
    redoubledBy: null,
    resolved: false,
  };
}

export interface GameState {
  phase: GamePhase;
  rules: RuleConfig;
  players: Record<Seat, Player>;
  dealer: Seat;
  deck: Deck;
  auction: AuctionState;
  /** Winning bid for current round. */
  contractBid: number | null;
  contractBidder: Seat | null;
  contractTeam: TeamId | null;
  trump: TrumpState;
  challenge: ChallengeState;
  marriage: MarriageState;
  tricks: Trick[];
  currentTrick: Trick | null;
  /** Whose turn to play / act. */
  toAct: Seat | null;
  /** Round card points. */
  pointsNS: number;
  pointsEW: number;
  scoreboard: GameScoreboard;
  roundNumber: number;
  /** Seats that have won at least one trick since trump reveal (for marriage). */
  tricksWonSinceReveal: Seat[];
}

export interface GameStateJSON {
  phase: GamePhase;
  rules: RuleConfig;
  players: Record<string, PlayerJSON>;
  dealer: Seat;
  deck: ReturnType<Deck['toJSON']>;
  auction: AuctionState;
  contractBid: number | null;
  contractBidder: Seat | null;
  contractTeam: TeamId | null;
  trump: TrumpState;
  challenge: ChallengeState;
  marriage: MarriageState;
  tricks: TrickJSON[];
  currentTrick: TrickJSON | null;
  toAct: Seat | null;
  pointsNS: number;
  pointsEW: number;
  scoreboard: GameScoreboard;
  roundNumber: number;
  tricksWonSinceReveal: Seat[];
}

export function createInitialState(
  players: Player[],
  rules?: Partial<RuleConfig>,
  dealer: Seat = Seat.South,
): GameState {
  if (players.length !== 4) {
    throw new Error('Twenty-Nine requires exactly 4 players');
  }
  const bySeat = {} as Record<Seat, Player>;
  for (const p of players) {
    bySeat[p.seat] = { ...p, hand: [] };
  }
  for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
    if (!bySeat[seat]) throw new Error(`Missing player for seat ${seat}`);
  }

  const firstBidder = nextSeat(dealer);
  return {
    phase: GamePhase.Waiting,
    rules: mergeRules(rules),
    players: bySeat,
    dealer,
    deck: new Deck(),
    auction: createEmptyAuction(firstBidder),
    contractBid: null,
    contractBidder: null,
    contractTeam: null,
    trump: createEmptyTrump(),
    challenge: createEmptyChallenge(),
    marriage: createEmptyMarriage(),
    tricks: [],
    currentTrick: null,
    toAct: null,
    pointsNS: 0,
    pointsEW: 0,
    scoreboard: createEmptyScoreboard(),
    roundNumber: 0,
    tricksWonSinceReveal: [],
  };
}

export function serializeState(state: GameState): GameStateJSON {
  return {
    phase: state.phase,
    rules: state.rules,
    players: {
      [Seat.North]: playerToJSON(state.players[Seat.North]),
      [Seat.East]: playerToJSON(state.players[Seat.East]),
      [Seat.South]: playerToJSON(state.players[Seat.South]),
      [Seat.West]: playerToJSON(state.players[Seat.West]),
    },
    dealer: state.dealer,
    deck: state.deck.toJSON(),
    auction: state.auction,
    contractBid: state.contractBid,
    contractBidder: state.contractBidder,
    contractTeam: state.contractTeam,
    trump: state.trump,
    challenge: state.challenge,
    marriage: state.marriage,
    tricks: state.tricks.map(trickToJSON),
    currentTrick: state.currentTrick ? trickToJSON(state.currentTrick) : null,
    toAct: state.toAct,
    pointsNS: state.pointsNS,
    pointsEW: state.pointsEW,
    scoreboard: state.scoreboard,
    roundNumber: state.roundNumber,
    tricksWonSinceReveal: state.tricksWonSinceReveal,
  };
}

export function deserializeState(json: GameStateJSON): GameState {
  return {
    phase: json.phase,
    rules: json.rules,
    players: {
      [Seat.North]: playerFromJSON(json.players[Seat.North]!),
      [Seat.East]: playerFromJSON(json.players[Seat.East]!),
      [Seat.South]: playerFromJSON(json.players[Seat.South]!),
      [Seat.West]: playerFromJSON(json.players[Seat.West]!),
    },
    dealer: json.dealer,
    deck: Deck.fromJSON(json.deck),
    auction: json.auction,
    contractBid: json.contractBid,
    contractBidder: json.contractBidder,
    contractTeam: json.contractTeam,
    trump: json.trump,
    challenge: json.challenge,
    marriage: json.marriage,
    tricks: json.tricks.map(trickFromJSON),
    currentTrick: json.currentTrick ? trickFromJSON(json.currentTrick) : null,
    toAct: json.toAct,
    pointsNS: json.pointsNS,
    pointsEW: json.pointsEW,
    scoreboard: json.scoreboard,
    roundNumber: json.roundNumber,
    tricksWonSinceReveal: json.tricksWonSinceReveal,
  };
}

/** Deep clone via serialize round-trip (also validates JSON shape). */
export function cloneState(state: GameState): GameState {
  return deserializeState(serializeState(state));
}

export function getAdjustedTarget(state: GameState): number | null {
  if (state.contractBid === null) return null;
  let target = state.contractBid + state.marriage.bidAdjustment;
  if (state.rules.clampMarriageTarget) {
    target = Math.max(
      state.rules.minBid,
      Math.min(state.rules.maxBid, target),
    );
  }
  return target;
}

export function visibleTrump(state: GameState): Suit | null {
  return state.trump.revealed ? state.trump.suit : null;
}

export function handOf(state: GameState, seat: Seat): Card[] {
  return state.players[seat].hand;
}
