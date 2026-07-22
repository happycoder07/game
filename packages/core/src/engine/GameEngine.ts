import { Deck } from '../entities/Deck.js';
import { Suit } from '../entities/Suit.js';
import { Seat, nextSeat, ALL_SEATS } from '../entities/Seat.js';
import { TeamId, teamForSeat } from '../entities/Team.js';
import type { Player } from '../entities/Player.js';
import { hasMarriage } from '../entities/Player.js';
import { createEmptyAuction } from '../entities/Bid.js';
import { createTrick, trickCardPoints } from '../entities/Trick.js';
import { createEmptyTrump } from '../entities/Trump.js';
import { createEmptyMarriage } from '../entities/Marriage.js';
import {
  GamePhase,
  canTransition,
  IllegalPhaseTransitionError,
} from '../fsm/GamePhase.js';
import { EventBus } from '../events/EventBus.js';
import type { EventListener, GameEvent } from '../events/GameEvent.js';
import { applyBid, resolveAuctionWinner } from '../rules/Bidding.js';
import {
  legalCards,
  resolveTrickWinnerSeat,
} from '../rules/TrickResolver.js';
import {
  computeMarriageBidAdjustment,
  scoreRound,
  applyRoundToScoreboard,
} from '../rules/Scoring.js';
import type { RuleConfig } from '../rules/RuleConfig.js';
import { createSeededRng } from './rng.js';
import {
  type GameState,
  type GameStateJSON,
  createInitialState,
  serializeState,
  deserializeState,
  cloneState,
  createEmptyChallenge,
  getAdjustedTarget,
} from './GameState.js';

export class IllegalMoveError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly seat?: Seat,
  ) {
    super(message);
    this.name = 'IllegalMoveError';
  }
}

/**
 * Pure Twenty-Nine game engine.
 *
 * - No UI / network dependencies
 * - All mutations go through command methods
 * - Emits domain events for observers
 * - Supports undo (snapshot stack) and full JSON serialize/restore
 */
export class GameEngine {
  private state: GameState;
  private readonly bus = new EventBus();
  private readonly undoStack: GameStateJSON[] = [];
  private rng: () => number;
  private readonly maxUndo: number;

  constructor(
    players: Player[],
    rules?: Partial<RuleConfig>,
    options?: { dealer?: Seat; maxUndo?: number },
  ) {
    this.state = createInitialState(players, rules, options?.dealer ?? Seat.South);
    this.maxUndo = options?.maxUndo ?? 200;
    this.rng = this.state.rules.seed !== null
      ? createSeededRng(this.state.rules.seed)
      : Math.random;
  }

  // ─── Observers ─────────────────────────────────────────────

  getState(): Readonly<GameState> {
    return this.state;
  }

  /** Player-perspective view: hides others' hands and hidden trump. */
  getPublicState(viewer?: Seat): GameStateJSON {
    const json = serializeState(this.state);

    for (const seat of ALL_SEATS) {
      if (viewer !== undefined && seat === viewer) continue;
      const count = json.players[seat]!.hand.length;
      json.players[seat]!.hand = [];
      (json.players[seat] as { handCount?: number }).handCount = count;
    }

    if (!json.trump.revealed) {
      const chooser = json.trump.chosenBy;
      if (viewer === undefined || chooser !== viewer) {
        json.trump = { ...json.trump, suit: null };
      }
    }
    return json;
  }

  subscribe(listener: EventListener): () => void {
    return this.bus.subscribe(listener);
  }

  // ─── Commands ──────────────────────────────────────────────

  /** Start the match / next round from Waiting or RoundEnd. */
  startRound(): void {
    this.pushUndo();
    if (this.state.phase === GamePhase.Finished) {
      throw new IllegalMoveError('Game is finished; create a new engine', 'startRound');
    }
    if (this.state.phase === GamePhase.Waiting || this.state.phase === GamePhase.RoundEnd) {
      this.transition(GamePhase.Shuffle);
      this.shuffleAndDealFirst();
      return;
    }
    throw new IllegalMoveError(
      `Cannot start round from phase ${this.state.phase}`,
      'startRound',
    );
  }

  /** Alias used by higher layers. */
  startGame(): void {
    this.startRound();
  }

  bid(seat: Seat, value: number): void {
    this.pushUndo();
    this.assertPhase(GamePhase.Bidding, 'bid', seat);
    this.assertToAct(seat, 'bid');

    try {
      this.state.auction = applyBid(this.state.auction, seat, 'bid', value, this.state.rules);
    } catch (e) {
      this.undoStack.pop(); // rollback snapshot we just pushed
      const msg = e instanceof Error ? e.message : String(e);
      this.emit({ type: 'IllegalMoveRejected', seat, reason: msg, command: 'bid' });
      throw new IllegalMoveError(msg, 'bid', seat);
    }

    this.emit({ type: 'BidPlaced', seat, action: 'bid', value });
    this.finishAuctionIfComplete();
  }

  pass(seat: Seat): void {
    this.pushUndo();
    this.assertPhase(GamePhase.Bidding, 'pass', seat);
    this.assertToAct(seat, 'pass');

    try {
      this.state.auction = applyBid(this.state.auction, seat, 'pass', undefined, this.state.rules);
    } catch (e) {
      this.undoStack.pop();
      const msg = e instanceof Error ? e.message : String(e);
      this.emit({ type: 'IllegalMoveRejected', seat, reason: msg, command: 'pass' });
      throw new IllegalMoveError(msg, 'pass', seat);
    }

    this.emit({ type: 'BidPlaced', seat, action: 'pass' });
    this.finishAuctionIfComplete();
  }

  /** Bid winner chooses trump (remains hidden). */
  chooseTrump(seat: Seat, suit: Suit): void {
    this.pushUndo();
    this.assertPhase(GamePhase.TrumpSelection, 'chooseTrump', seat);
    if (seat !== this.state.contractBidder) {
      this.fail('chooseTrump', seat, 'Only the bid winner may choose trump');
    }
    if (!Object.values(Suit).includes(suit)) {
      this.fail('chooseTrump', seat, 'Invalid suit');
    }

    this.state.trump = {
      suit,
      chosenBy: seat,
      revealed: false,
      revealedBy: null,
      revealedOnTrick: null,
    };
    this.emit({ type: 'TrumpChosen', seat, suit, hidden: true });

    if (this.state.rules.allowDouble) {
      this.transition(GamePhase.Challenge);
      // Defenders may double; default toAct = left of bidder
      this.state.toAct = nextSeat(seat);
    } else {
      this.dealSecond();
    }
  }

  double(seat: Seat): void {
    this.pushUndo();
    this.assertPhase(GamePhase.Challenge, 'double', seat);
    if (!this.state.rules.allowDouble) {
      this.fail('double', seat, 'Doubling is disabled');
    }
    if (teamForSeat(seat) === this.state.contractTeam) {
      this.fail('double', seat, 'Bidding team cannot double');
    }
    if (this.state.challenge.doubled) {
      this.fail('double', seat, 'Already doubled');
    }
    this.state.challenge.doubled = true;
    this.state.challenge.doubledBy = seat;
    this.emit({ type: 'DoubleDeclared', seat });
    // Offer redouble to bidding team
    this.state.toAct = this.state.contractBidder;
  }

  redouble(seat: Seat): void {
    this.pushUndo();
    this.assertPhase(GamePhase.Challenge, 'redouble', seat);
    if (!this.state.rules.allowRedouble) {
      this.fail('redouble', seat, 'Redoubling is disabled');
    }
    if (!this.state.challenge.doubled) {
      this.fail('redouble', seat, 'Cannot redouble before double');
    }
    if (teamForSeat(seat) !== this.state.contractTeam) {
      this.fail('redouble', seat, 'Only bidding team may redouble');
    }
    if (this.state.challenge.redoubled) {
      this.fail('redouble', seat, 'Already redoubled');
    }
    this.state.challenge.redoubled = true;
    this.state.challenge.redoubledBy = seat;
    this.emit({ type: 'RedoubleDeclared', seat });
    this.state.challenge.resolved = true;
    this.dealSecond();
  }

  /** Pass on double/redouble opportunity → proceed to second deal. */
  passChallenge(seat: Seat): void {
    this.pushUndo();
    this.assertPhase(GamePhase.Challenge, 'passChallenge', seat);
    // Any eligible actor declining ends the challenge window
    this.state.challenge.resolved = true;
    this.dealSecond();
  }

  /** Explicit voluntary trump reveal. */
  revealTrump(seat: Seat, reason: 'voluntary' | 'failToFollow' | 'auto' = 'voluntary'): void {
    this.pushUndo();
    if (this.state.phase !== GamePhase.Playing) {
      this.fail('revealTrump', seat, 'Can only reveal during play');
    }
    if (!this.state.trump.suit) {
      this.fail('revealTrump', seat, 'No trump has been chosen');
    }
    if (this.state.trump.revealed) {
      this.fail('revealTrump', seat, 'Trump already revealed');
    }
    if (reason === 'voluntary' && !this.state.rules.allowVoluntaryReveal) {
      this.fail('revealTrump', seat, 'Voluntary reveal is disabled');
    }
    if (reason === 'voluntary' && this.state.toAct !== seat) {
      this.fail('revealTrump', seat, 'Not your turn');
    }

    this.doReveal(seat, reason);
  }

  playCard(seat: Seat, cardId: string): void {
    this.pushUndo();
    this.assertPhase(GamePhase.Playing, 'playCard', seat);
    this.assertToAct(seat, 'playCard');

    const player = this.state.players[seat];
    const cardIndex = player.hand.findIndex((c) => c.id === cardId);
    if (cardIndex < 0) {
      this.fail('playCard', seat, 'Card not in hand');
    }
    const card = player.hand[cardIndex]!;

    let trick = this.state.currentTrick;
    if (!trick) {
      this.fail('playCard', seat, 'No current trick');
    }

    // Auto-reveal when player cannot follow and rules say so
    if (
      trick.plays.length > 0 &&
      this.state.trump.suit &&
      !this.state.trump.revealed &&
      this.state.rules.autoRevealOnFailToFollow
    ) {
      const leadSuit = trick.leadSuit ?? trick.plays[0]!.card.suit;
      const canFollow = player.hand.some((c) => c.suit === leadSuit);
      if (!canFollow) {
        this.doReveal(seat, 'failToFollow');
      }
    }

    const legal = legalCards(
      player.hand,
      trick,
      this.state.trump.suit,
      this.state.trump.revealed,
      this.state.rules,
    );
    if (!legal.some((c) => c.equals(card))) {
      this.fail('playCard', seat, 'Illegal card — must follow suit / undertrump rules');
    }

    // Remove from hand
    player.hand = player.hand.filter((_, i) => i !== cardIndex);

    if (trick.plays.length === 0) {
      trick.leadSuit = card.suit;
    }
    trick.plays.push({ seat, card });

    this.emit({
      type: 'CardPlayed',
      seat,
      card: card.toJSON(),
      trickIndex: trick.index,
    });

    if (trick.plays.length === 4) {
      this.completeTrick(trick);
    } else {
      this.state.toAct = nextSeat(seat);
    }
  }

  declareMarriage(seat: Seat): void {
    this.pushUndo();
    this.assertPhase(GamePhase.Playing, 'declareMarriage', seat);

    if (!this.state.trump.revealed || !this.state.trump.suit) {
      this.fail('declareMarriage', seat, 'Marriage only valid after trump is revealed');
    }
    if (!this.state.contractTeam) {
      this.fail('declareMarriage', seat, 'No contract');
    }

    const trump = this.state.trump.suit;
    const player = this.state.players[seat];
    if (!hasMarriage(player.hand, trump)) {
      // Also allow if K+Q already played this round? Official: must hold both.
      // Check hand only (standard).
      this.fail('declareMarriage', seat, 'Must hold King and Queen of trump');
    }

    const team = teamForSeat(seat);
    if (this.state.marriage.declarations.some((d) => d.team === team)) {
      this.fail('declareMarriage', seat, 'Team already declared marriage');
    }

    if (this.state.rules.marriageRequiresWonTrick) {
      const teamSeats = ALL_SEATS.filter((s) => teamForSeat(s) === team);
      const won = this.state.tricksWonSinceReveal.some((s) => teamSeats.includes(s));
      if (!won) {
        this.fail(
          'declareMarriage',
          seat,
          'Must win a trick after trump reveal before declaring marriage',
        );
      }
    }

    const adj = computeMarriageBidAdjustment(team, this.state.contractTeam, this.state.rules);
    this.state.marriage.declarations.push({
      seat,
      team,
      trump,
      trickIndex: this.state.currentTrick?.index ?? this.state.tricks.length,
    });
    this.state.marriage.bidAdjustment += adj;

    const newTarget = getAdjustedTarget(this.state)!;
    this.emit({
      type: 'MarriageDeclared',
      seat,
      team,
      bidAdjustment: this.state.marriage.bidAdjustment,
      newTarget,
    });
  }

  /** Debug / tooling: undo last command. */
  undo(steps: number = 1): void {
    if (steps < 1) return;
    let applied = 0;
    for (let i = 0; i < steps; i++) {
      const snap = this.undoStack.pop();
      if (!snap) break;
      this.state = deserializeState(snap);
      applied++;
    }
    if (applied > 0) {
      this.emit({ type: 'UndoApplied', steps: applied });
    }
  }

  saveGame(): string {
    return JSON.stringify(serializeState(this.state), null, 2);
  }

  static loadGame(json: string, players?: Player[]): GameEngine {
    const data = JSON.parse(json) as GameStateJSON;
    const state = deserializeState(data);
    // Reconstruct engine with dummy players then replace state
    const pls =
      players ??
      ALL_SEATS.map((seat) => state.players[seat]);
    const engine = new GameEngine(pls, state.rules, { dealer: state.dealer });
    engine.state = state;
    engine.rng =
      state.rules.seed !== null ? createSeededRng(state.rules.seed) : Math.random;
    return engine;
  }

  /** Legal card ids for the current actor (empty if not playing). */
  getLegalMoves(seat: Seat): string[] {
    if (this.state.phase !== GamePhase.Playing || this.state.toAct !== seat) return [];
    const trick = this.state.currentTrick;
    if (!trick) return [];
    return legalCards(
      this.state.players[seat].hand,
      trick,
      this.state.trump.suit,
      this.state.trump.revealed,
      this.state.rules,
    ).map((c) => c.id);
  }

  getLegalBids(seat: Seat): number[] {
    if (this.state.phase !== GamePhase.Bidding || this.state.auction.toAct !== seat) {
      return [];
    }
    const min =
      this.state.auction.currentBid === null
        ? this.state.rules.minBid
        : this.state.auction.currentBid + 1;
    const out: number[] = [];
    for (let v = min; v <= this.state.rules.maxBid; v++) out.push(v);
    return out;
  }

  // ─── Internals ─────────────────────────────────────────────

  private shuffleAndDealFirst(): void {
    this.emit({ type: 'DeckShuffled' });
    // Clear hands
    for (const seat of ALL_SEATS) {
      this.state.players[seat].hand = [];
    }
    this.state.deck = new Deck().shuffle(this.rng);
    this.transition(GamePhase.DealFirst);

    // Deal 4 cards each, clockwise from left of dealer
    let seat = nextSeat(this.state.dealer);
    for (let i = 0; i < 4; i++) {
      for (let p = 0; p < 4; p++) {
        const cards = this.state.deck.deal(1);
        this.state.players[seat].hand.push(...cards);
        seat = nextSeat(seat);
      }
    }
    // Actually dealing 1 at a time × 4 rounds = 4 each. Good.
    // Reset seat loop — wait, the nested loop deals 16 cards correctly.

    this.emit({ type: 'CardsDealt', dealPass: 1, cardsPerPlayer: 4 });

    // Reset round fields
    this.state.roundNumber += 1;
    this.state.auction = createEmptyAuction(nextSeat(this.state.dealer));
    this.state.contractBid = null;
    this.state.contractBidder = null;
    this.state.contractTeam = null;
    this.state.trump = createEmptyTrump();
    this.state.challenge = createEmptyChallenge();
    this.state.marriage = createEmptyMarriage();
    this.state.tricks = [];
    this.state.currentTrick = null;
    this.state.pointsNS = 0;
    this.state.pointsEW = 0;
    this.state.tricksWonSinceReveal = [];

    this.transition(GamePhase.Bidding);
    this.state.toAct = this.state.auction.toAct;
    this.emit({
      type: 'GameStarted',
      dealer: this.state.dealer,
      rules: this.state.rules,
    });
  }

  private finishAuctionIfComplete(): void {
    if (!this.state.auction.complete) {
      this.state.toAct = this.state.auction.toAct;
      return;
    }

    const result = resolveAuctionWinner(
      this.state.auction,
      this.state.dealer,
      nextSeat(this.state.dealer),
      this.state.rules,
    );

    if (!result) {
      // All passed, no force — redeal
      this.transition(GamePhase.Shuffle);
      this.shuffleAndDealFirst();
      return;
    }

    this.state.contractBid = result.bid;
    this.state.contractBidder = result.winner;
    this.state.contractTeam = teamForSeat(result.winner);
    this.state.toAct = result.winner;

    this.emit({
      type: 'AuctionComplete',
      winner: result.winner,
      bid: result.bid,
      team: this.state.contractTeam,
    });
    this.transition(GamePhase.TrumpSelection);
  }

  private dealSecond(): void {
    this.transition(GamePhase.DealSecond);
    let seat = nextSeat(this.state.dealer);
    for (let i = 0; i < 4; i++) {
      for (let p = 0; p < 4; p++) {
        const cards = this.state.deck.deal(1);
        this.state.players[seat].hand.push(...cards);
        seat = nextSeat(seat);
      }
    }
    this.emit({ type: 'CardsDealt', dealPass: 2, cardsPerPlayer: 4 });

    // Lead: left of dealer
    const leader = nextSeat(this.state.dealer);
    this.state.currentTrick = createTrick(0, leader);
    this.state.toAct = leader;
    this.transition(GamePhase.Playing);
  }

  private doReveal(seat: Seat, reason: 'failToFollow' | 'voluntary' | 'auto'): void {
    if (this.state.trump.revealed || !this.state.trump.suit) return;
    this.state.trump.revealed = true;
    this.state.trump.revealedBy = seat;
    this.state.trump.revealedOnTrick = this.state.currentTrick?.index ?? null;
    this.state.tricksWonSinceReveal = [];
    this.emit({
      type: 'TrumpRevealed',
      suit: this.state.trump.suit,
      by: seat,
      reason,
    });
  }

  private completeTrick(trick: ReturnType<typeof createTrick>): void {
    const winner = resolveTrickWinnerSeat(
      trick,
      this.state.trump.suit,
      this.state.trump.revealed,
    );
    trick.winner = winner;
    let points = trickCardPoints(trick);
    // Last trick (index 7) gets +1
    if (trick.index === 7) {
      points += 1;
    }
    trick.cardPoints = points;

    const team = teamForSeat(winner);
    if (team === TeamId.NS) this.state.pointsNS += points;
    else this.state.pointsEW += points;

    if (this.state.trump.revealed) {
      this.state.tricksWonSinceReveal.push(winner);
    }

    this.state.tricks.push(trick);
    this.state.currentTrick = null;

    this.emit({
      type: 'TrickWon',
      winner,
      team,
      trickIndex: trick.index,
      points,
    });

    if (trick.index === 7) {
      this.scoreCurrentRound();
    } else {
      const next = createTrick(trick.index + 1, winner);
      this.state.currentTrick = next;
      this.state.toAct = winner;
    }
  }

  private scoreCurrentRound(): void {
    this.transition(GamePhase.Scoring);

    const multiplier = this.state.challenge.redoubled
      ? 4
      : this.state.challenge.doubled
        ? 2
        : 1;

    const adjustedTarget = getAdjustedTarget(this.state)!;
    const round = scoreRound({
      bidValue: this.state.contractBid!,
      adjustedTarget,
      biddingTeam: this.state.contractTeam!,
      bidderSeat: this.state.contractBidder!,
      trump: this.state.trump.suit,
      pointsNS: this.state.pointsNS,
      pointsEW: this.state.pointsEW,
      multiplier,
    });

    const applied = applyRoundToScoreboard(
      this.state.scoreboard.ns,
      this.state.scoreboard.ew,
      round,
      this.state.rules,
    );

    this.state.scoreboard.ns = applied.ns;
    this.state.scoreboard.ew = applied.ew;
    this.state.scoreboard.roundHistory.push(round);
    this.state.scoreboard.winner = applied.winner;

    this.emit({ type: 'RoundScored', score: round });
    this.emit({
      type: 'RoundWon',
      team: round.bidMade ? round.biddingTeam : (round.biddingTeam === TeamId.NS ? TeamId.EW : TeamId.NS),
      score: round,
    });

    if (applied.winner) {
      this.transition(GamePhase.Finished);
      this.emit({
        type: 'GameFinished',
        winner: applied.winner,
        ns: applied.ns,
        ew: applied.ew,
      });
    } else {
      this.transition(GamePhase.RoundEnd);
      // Rotate dealer
      this.state.dealer = nextSeat(this.state.dealer);
      this.state.toAct = null;
    }
  }

  private transition(to: GamePhase): void {
    const from = this.state.phase;
    if (!canTransition(from, to)) {
      throw new IllegalPhaseTransitionError(from, to);
    }
    this.state.phase = to;
    this.emit({ type: 'PhaseChanged', from, to });
  }

  private assertPhase(phase: GamePhase, command: string, seat?: Seat): void {
    if (this.state.phase !== phase) {
      this.fail(command, seat, `Invalid phase: expected ${phase}, got ${this.state.phase}`);
    }
  }

  private assertToAct(seat: Seat, command: string): void {
    if (this.state.phase === GamePhase.Bidding) {
      if (this.state.auction.toAct !== seat) {
        this.fail(command, seat, `Not your turn to bid`);
      }
      return;
    }
    if (this.state.toAct !== seat) {
      this.fail(command, seat, `Not your turn (to act: ${this.state.toAct})`);
    }
  }

  private fail(command: string, seat: Seat | undefined, reason: string): never {
    this.undoStack.pop();
    if (seat) {
      this.emit({ type: 'IllegalMoveRejected', seat, reason, command });
    }
    throw new IllegalMoveError(reason, command, seat);
  }

  private pushUndo(): void {
    this.undoStack.push(serializeState(cloneState(this.state)));
    if (this.undoStack.length > this.maxUndo) {
      this.undoStack.shift();
    }
  }

  private emit(event: GameEvent): void {
    this.bus.emit(event);
  }
}
