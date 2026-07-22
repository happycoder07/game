# AI

Three levels share the same command interface (`AiDecision` → `applyAiDecision`).

## Easy

Uniform random among legal bids / cards. Occasional voluntary trump reveal.

## Medium

Heuristics:

- Bid from estimated hand strength (points + length + jack bonus).
- Trump = longest / strongest suit (marriage potential valued).
- Lead jacks; dump low points when partner is winning; take cheapest winners.
- Declare marriage when legal.
- Rare doubles on high contracts.

## Hard

Adds:

- Card tracking (played set, remaining per suit).
- Strategic trump reveal when a high-point trick is available and cannot follow.
- Point-need awareness vs adjusted bid target.
- Partner-hold estimation before feeding point cards.
- Suit-control bonuses when bidding.

## Simulation

```bash
SIM_GAMES=100000 SIM_LEVEL=hard npm run sim -w @twenty-nine/core
```

Reports win rate, average bid, make%, mistakes, throughput.
