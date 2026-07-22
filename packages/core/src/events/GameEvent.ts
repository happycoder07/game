import type { CardJSON } from '../entities/Card.js';
import type { Seat } from '../entities/Seat.js';
import type { Suit } from '../entities/Suit.js';
import type { TeamId } from '../entities/Team.js';
import type { BidAction } from '../entities/Bid.js';
import type { RoundScore } from '../entities/Score.js';
import type { GamePhase } from '../fsm/GamePhase.js';

/**
 * Domain events emitted by the engine. UI / networking subscribe;
 * the engine never depends on subscribers.
 */
export type GameEvent =
  | { type: 'GameStarted'; dealer: Seat; rules: unknown }
  | { type: 'PhaseChanged'; from: GamePhase; to: GamePhase }
  | { type: 'DeckShuffled' }
  | { type: 'CardsDealt'; dealPass: 1 | 2; cardsPerPlayer: number }
  | { type: 'BidPlaced'; seat: Seat; action: BidAction; value?: number }
  | { type: 'AuctionComplete'; winner: Seat; bid: number; team: TeamId }
  | { type: 'TrumpChosen'; seat: Seat; suit: Suit; hidden: true }
  | { type: 'TrumpRevealed'; suit: Suit; by: Seat; reason: 'failToFollow' | 'voluntary' | 'auto' }
  | { type: 'DoubleDeclared'; seat: Seat }
  | { type: 'RedoubleDeclared'; seat: Seat }
  | { type: 'CardPlayed'; seat: Seat; card: CardJSON; trickIndex: number }
  | { type: 'TrickWon'; winner: Seat; team: TeamId; trickIndex: number; points: number }
  | { type: 'MarriageDeclared'; seat: Seat; team: TeamId; bidAdjustment: number; newTarget: number }
  | { type: 'RoundScored'; score: RoundScore }
  | { type: 'RoundWon'; team: TeamId; score: RoundScore }
  | { type: 'GameFinished'; winner: TeamId; ns: number; ew: number }
  | { type: 'UndoApplied'; steps: number }
  | { type: 'IllegalMoveRejected'; seat: Seat; reason: string; command: string };

export type GameEventType = GameEvent['type'];

export type EventListener = (event: GameEvent) => void;
