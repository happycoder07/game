/**
 * Barrel exports for @twenty-nine/core
 */
export { Suit, ALL_SUITS, suitDisplayName, suitSymbol, isRedSuit } from './entities/Suit.js';
export {
  Rank,
  ALL_RANKS,
  RANK_ORDER,
  POINT_VALUES,
  rankDisplayName,
} from './entities/Rank.js';
export { Card, compareSameSuit, type CardJSON } from './entities/Card.js';
export {
  Deck,
  DECK_CARD_POINTS,
  LAST_TRICK_BONUS,
  TOTAL_ROUND_POINTS,
} from './entities/Deck.js';
export {
  Seat,
  ALL_SEATS,
  CLOCKWISE,
  nextSeat,
  previousSeat,
  oppositeSeat,
  seatDisplayName,
} from './entities/Seat.js';
export {
  TeamId,
  teamForSeat,
  partnerOf,
  seatsOfTeam,
  opposingTeam,
  createEmptyTeamScore,
  type TeamScore,
} from './entities/Team.js';
export {
  createPlayer,
  sortHand,
  hasMarriage,
  cardsOfSuit,
  playerToJSON,
  playerFromJSON,
  type Player,
  type PlayerJSON,
  type PlayerKind,
  type AiLevel,
} from './entities/Player.js';
export {
  createEmptyAuction,
  type Bid,
  type BidJSON,
  type BidAction,
  type AuctionState,
} from './entities/Bid.js';
export {
  createTrick,
  trickCardPoints,
  trickWinningTeam,
  trickToJSON,
  trickFromJSON,
  type Trick,
  type TrickJSON,
  type TrickPlay,
} from './entities/Trick.js';
export { createEmptyTrump, type TrumpState } from './entities/Trump.js';
export {
  createEmptyMarriage,
  type MarriageDeclaration,
  type MarriageState,
} from './entities/Marriage.js';
export {
  createEmptyScoreboard,
  type RoundScore,
  type GameScoreboard,
} from './entities/Score.js';

export { GamePhase, PHASE_TRANSITIONS, canTransition, IllegalPhaseTransitionError } from './fsm/GamePhase.js';
export { type GameEvent, type GameEventType, type EventListener } from './events/GameEvent.js';
export { EventBus } from './events/EventBus.js';

export { DEFAULT_RULES, mergeRules, type RuleConfig } from './rules/RuleConfig.js';
export {
  resolveTrickWinner,
  resolveTrickWinnerSeat,
  legalCards,
} from './rules/TrickResolver.js';
export {
  validateBid,
  applyBid,
  resolveAuctionWinner,
  BidValidationError,
} from './rules/Bidding.js';
export {
  computeAdjustedTarget,
  computeMarriageBidAdjustment,
  scoreRound,
  applyRoundToScoreboard,
} from './rules/Scoring.js';

export { GameEngine, IllegalMoveError } from './engine/GameEngine.js';
export {
  createInitialState,
  serializeState,
  deserializeState,
  cloneState,
  getAdjustedTarget,
  visibleTrump,
  type GameState,
  type GameStateJSON,
  type ChallengeState,
} from './engine/GameState.js';
export { createSeededRng, randomInt, pickRandom } from './engine/rng.js';

export {
  decide,
  decideEasy,
  decideMedium,
  decideHard,
  applyAiDecision,
  runAiUntilHuman,
  estimateHandStrength,
  pickBestTrumpSuit,
  type AiDecision,
} from './ai/AiPlayer.js';
