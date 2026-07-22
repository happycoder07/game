/**
 * Explicit finite state machine phases for a Twenty-Nine match / round.
 * Invalid transitions are rejected by the engine.
 */
export enum GamePhase {
  /** Lobby — waiting for 4 players / start command. */
  Waiting = 'Waiting',
  /** Shuffling the deck. */
  Shuffle = 'Shuffle',
  /** Dealing first 4 cards. */
  DealFirst = 'DealFirst',
  /** Auction in progress. */
  Bidding = 'Bidding',
  /** Bid winner selects hidden trump. */
  TrumpSelection = 'TrumpSelection',
  /** Optional double / redouble window after trump chosen (before second deal). */
  Challenge = 'Challenge',
  /** Dealing remaining 4 cards. */
  DealSecond = 'DealSecond',
  /** Playing tricks. */
  Playing = 'Playing',
  /** Round over — computing score. */
  Scoring = 'Scoring',
  /** Between rounds — ready to deal next. */
  RoundEnd = 'RoundEnd',
  /** Match finished (win/lose target reached). */
  Finished = 'Finished',
}

/** Legal transitions. Empty set = terminal (must start new game). */
export const PHASE_TRANSITIONS: Readonly<Record<GamePhase, readonly GamePhase[]>> = {
  [GamePhase.Waiting]: [GamePhase.Shuffle],
  [GamePhase.Shuffle]: [GamePhase.DealFirst],
  [GamePhase.DealFirst]: [GamePhase.Bidding],
  /** TrumpSelection on auction win; Shuffle when all pass and force-bid is off (redeal). */
  [GamePhase.Bidding]: [GamePhase.TrumpSelection, GamePhase.Shuffle],
  [GamePhase.TrumpSelection]: [GamePhase.Challenge, GamePhase.DealSecond],
  [GamePhase.Challenge]: [GamePhase.DealSecond],
  [GamePhase.DealSecond]: [GamePhase.Playing],
  [GamePhase.Playing]: [GamePhase.Scoring],
  [GamePhase.Scoring]: [GamePhase.RoundEnd, GamePhase.Finished],
  [GamePhase.RoundEnd]: [GamePhase.Shuffle, GamePhase.Finished],
  [GamePhase.Finished]: [GamePhase.Waiting],
};

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  return PHASE_TRANSITIONS[from].includes(to);
}

export class IllegalPhaseTransitionError extends Error {
  constructor(from: GamePhase, to: GamePhase) {
    super(`Illegal phase transition: ${from} → ${to}`);
    this.name = 'IllegalPhaseTransitionError';
  }
}
