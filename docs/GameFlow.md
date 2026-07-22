# Game Flow

```mermaid
stateDiagram-v2
  [*] --> Waiting
  Waiting --> Shuffle: startRound
  Shuffle --> DealFirst
  DealFirst --> Bidding
  Bidding --> TrumpSelection: auction won
  Bidding --> Shuffle: all pass (no force)
  TrumpSelection --> Challenge: allowDouble
  TrumpSelection --> DealSecond
  Challenge --> DealSecond
  DealSecond --> Playing
  Playing --> Scoring: 8 tricks done
  Scoring --> RoundEnd
  Scoring --> Finished: ±6 reached
  RoundEnd --> Shuffle: next round
  Finished --> Waiting: new match
```

## Per-trick

1. Leader plays any card.
2. Others must follow suit if able.
3. On fail-to-follow, trump may auto-reveal.
4. Fourth card → resolve winner → award points → winner leads.
5. Trick 8 (+1 last-trick bonus) → scoring.

## Engine commands map

| Phase | Commands |
|-------|----------|
| Waiting / RoundEnd | `startRound` |
| Bidding | `bid`, `pass` |
| TrumpSelection | `chooseTrump` |
| Challenge | `double`, `redouble`, `passChallenge` |
| Playing | `playCard`, `revealTrump`, `declareMarriage` |
| Any (debug) | `undo`, `saveGame` |
