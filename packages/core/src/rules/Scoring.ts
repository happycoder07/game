import type { RoundScore } from '../entities/Score.js';
import type { MarriageState } from '../entities/Marriage.js';
import { TeamId, opposingTeam } from '../entities/Team.js';
import type { Seat } from '../entities/Seat.js';
import type { Suit } from '../entities/Suit.js';
import type { RuleConfig } from './RuleConfig.js';

export function computeAdjustedTarget(
  bidValue: number,
  marriage: MarriageState,
  rules: RuleConfig,
): number {
  let target = bidValue + marriage.bidAdjustment;
  if (rules.clampMarriageTarget) {
    target = Math.max(rules.minBid, Math.min(rules.maxBid, target));
  }
  return target;
}

export function computeMarriageBidAdjustment(
  declaringTeam: TeamId,
  biddingTeam: TeamId,
  rules: RuleConfig,
): number {
  // Bidder team marriage → easier (negative adjustment)
  // Defender marriage → harder for bidder (positive adjustment)
  if (declaringTeam === biddingTeam) {
    return -rules.marriageDelta;
  }
  return rules.marriageDelta;
}

export function scoreRound(params: {
  bidValue: number;
  adjustedTarget: number;
  biddingTeam: TeamId;
  bidderSeat: Seat;
  trump: Suit | null;
  pointsNS: number;
  pointsEW: number;
  multiplier: number;
}): RoundScore {
  const bidderPoints =
    params.biddingTeam === TeamId.NS ? params.pointsNS : params.pointsEW;
  const bidMade = bidderPoints >= params.adjustedTarget;
  const base = bidMade ? 1 : -1;
  const gamePointDelta = base * params.multiplier;

  return {
    bidValue: params.bidValue,
    adjustedTarget: params.adjustedTarget,
    biddingTeam: params.biddingTeam,
    bidderSeat: params.bidderSeat,
    trump: params.trump,
    pointsNS: params.pointsNS,
    pointsEW: params.pointsEW,
    bidMade,
    gamePointDelta,
    multiplier: params.multiplier,
  };
}

/**
 * Apply round score to cumulative game points.
 * Official: only the bidding team's game points change by ±multiplier.
 * Some casual variants give defenders +1 on set — we stick to bidder ±1.
 */
export function applyRoundToScoreboard(
  ns: number,
  ew: number,
  round: RoundScore,
  rules: RuleConfig,
): { ns: number; ew: number; winner: TeamId | null } {
  let newNs = ns;
  let newEw = ew;

  if (round.biddingTeam === TeamId.NS) {
    newNs += round.gamePointDelta;
  } else {
    newEw += round.gamePointDelta;
  }

  let winner: TeamId | null = null;
  if (newNs >= rules.winTarget) winner = TeamId.NS;
  else if (newEw >= rules.winTarget) winner = TeamId.EW;
  else if (newNs <= -rules.loseTarget) winner = opposingTeam(TeamId.NS);
  else if (newEw <= -rules.loseTarget) winner = opposingTeam(TeamId.EW);

  return { ns: newNs, ew: newEw, winner };
}
