# Twenty-Nine Rules (India / Bangladesh table)

Configurable via `RuleConfig`. Defaults match common competitive play.

## Deck

32 cards: A K Q J 10 9 8 7 in four suits.

## Points

| Card | Points |
|------|--------|
| Jack | 3 |
| Nine | 2 |
| Ace | 1 |
| Ten | 1 |
| K Q 8 7 | 0 |

Sum of cards = **28**. Last trick = **+1**. Total = **29**.

## Ranking (trump and plain)

J > 9 > A > 10 > K > Q > 8 > 7

## Players

Four seats: North, East, South, West. Partners: N–S and E–W.

## Deal

1. Shuffle.
2. Deal **4** cards each.
3. Auction.
4. Bid winner chooses **hidden** trump.
5. Optional double / redouble.
6. Deal remaining **4** cards each.
7. Left of dealer leads.

## Bidding

- Range **16–28** (configurable).
- Pass allowed.
- Must raise current bid.
- If all pass and `forceBidIfAllPass`, dealer takes minimum bid.
- Dealer rotates each round.

## Trump

- Chosen by bid winner; remains **hidden**.
- Revealed when a player cannot follow suit (`autoRevealOnFailToFollow`), or via voluntary reveal.
- After reveal, everyone knows trump.

## Play

- Must follow suit if able.
- Highest trump wins if trump is in play and revealed; else highest of lead suit.
- Optional regional `undertrumpForbidden`.

## Marriage (pair / royals)

- King + Queen of **trump**, only after trump is revealed.
- Optionally requires the declaring side to have won a trick after reveal.
- Bidding team declares → target **−4**.
- Defending team declares → target **+4**.
- Target clamped to `[minBid, maxBid]` when enabled.

## Scoring

- Bidding team needs ≥ adjusted target card points (incl. last-trick bonus).
- Success: bidding team **+1** game point (×2 if doubled, ×4 if redoubled).
- Failure: bidding team **−1** (same multiplier).
- First to **+6** wins; **−6** loses (opponents win).

## Variants toggles

See `DEFAULT_RULES` in `packages/core/src/rules/RuleConfig.ts`.
