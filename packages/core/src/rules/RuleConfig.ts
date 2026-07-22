/**
 * Configurable regional rule variants for Twenty-Nine.
 * Defaults match the most common India/Bangladesh "official table" rules.
 */
export interface RuleConfig {
  /** Minimum opening bid (common: 16; some regions use 15). */
  minBid: number;
  /** Maximum bid (common: 28). */
  maxBid: number;
  /** Game points needed to win the match. */
  winTarget: number;
  /** Absolute value of negative game points that loses the match. */
  loseTarget: number;
  /**
   * Marriage bid adjustment magnitude.
   * Bidder team: target -= marriageDelta; defenders: target += marriageDelta.
   */
  marriageDelta: number;
  /** Whether marriage may be declared only after declaring side won a post-reveal trick. */
  marriageRequiresWonTrick: boolean;
  /** Clamp adjusted target to [minBid, maxBid]. */
  clampMarriageTarget: boolean;
  /** Allow explicit "reveal trump" request by the current player. */
  allowVoluntaryReveal: boolean;
  /**
   * If true, trump auto-reveals when a player cannot follow suit
   * (even before they play — typically reveal happens when they play off-suit / trump).
   * Official: trump is shown when you fail to follow and need/choose to play trump.
   */
  autoRevealOnFailToFollow: boolean;
  /**
   * Forced bid: if all pass, dealer (or first bidder) is forced to take minBid.
   * Common in competitive play.
   */
  forceBidIfAllPass: boolean;
  /** Who is forced when all pass: 'dealer' | 'firstBidder'. */
  forcedBidSeat: 'dealer' | 'firstBidder';
  /** Double / redouble challenge support. */
  allowDouble: boolean;
  allowRedouble: boolean;
  /** Undertrump restriction: cannot play a lower trump when already trumped (regional). */
  undertrumpForbidden: boolean;
  /** Dealer deals to the left (clockwise) — standard. */
  dealClockwise: boolean;
  /** Player to left of dealer opens bidding. */
  bidStartsLeftOfDealer: boolean;
  /** Player to left of dealer leads first trick (after trump chosen & second deal). */
  leadStartsLeftOfDealer: boolean;
  /** RNG seed for deterministic shuffle (tests / replays). null = Math.random. */
  seed: number | null;
}

export const DEFAULT_RULES: Readonly<RuleConfig> = {
  minBid: 16,
  maxBid: 28,
  winTarget: 6,
  loseTarget: 6,
  marriageDelta: 4,
  marriageRequiresWonTrick: true,
  clampMarriageTarget: true,
  allowVoluntaryReveal: true,
  autoRevealOnFailToFollow: true,
  forceBidIfAllPass: true,
  forcedBidSeat: 'dealer',
  allowDouble: true,
  allowRedouble: true,
  undertrumpForbidden: false,
  dealClockwise: true,
  bidStartsLeftOfDealer: true,
  leadStartsLeftOfDealer: true,
  seed: null,
};

export function mergeRules(partial?: Partial<RuleConfig>): RuleConfig {
  return { ...DEFAULT_RULES, ...partial };
}
