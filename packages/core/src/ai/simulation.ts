/**
 * Bot simulation harness — runs many AI-vs-AI games and reports stats.
 *
 * Usage: npm run sim -w @twenty-nine/core
 * Optional: SIM_GAMES=100000 SIM_LEVEL=hard
 */
import {
  createPlayer,
  GameEngine,
  Seat,
  TeamId,
  decide,
  applyAiDecision,
  GamePhase,
  type AiLevel,
} from '../index.js';

interface SimStats {
  games: number;
  nsWins: number;
  ewWins: number;
  totalRounds: number;
  totalBids: number;
  bidSum: number;
  bidMade: number;
  bidFailed: number;
  mistakes: number;
  durationsMs: number[];
}

function createAiPlayers(level: AiLevel) {
  return [
    createPlayer({ id: 'n', name: 'North', seat: Seat.North, kind: 'ai', aiLevel: level }),
    createPlayer({ id: 'e', name: 'East', seat: Seat.East, kind: 'ai', aiLevel: level }),
    createPlayer({ id: 's', name: 'South', seat: Seat.South, kind: 'ai', aiLevel: level }),
    createPlayer({ id: 'w', name: 'West', seat: Seat.West, kind: 'ai', aiLevel: level }),
  ];
}

function playOneGame(seed: number, level: AiLevel): {
  winner: TeamId;
  rounds: number;
  bids: number[];
  made: number;
  failed: number;
  mistakes: number;
  ms: number;
} {
  const t0 = performance.now();
  const engine = new GameEngine(createAiPlayers(level), {
    seed,
    allowDouble: false, // keep sims simpler / faster
  });
  let mistakes = 0;
  const bids: number[] = [];
  let made = 0;
  let failed = 0;
  let steps = 0;

  engine.startRound();

  while (engine.getState().phase !== GamePhase.Finished && steps < 5000) {
    steps++;
    const state = engine.getState();

    if (state.phase === GamePhase.RoundEnd) {
      // Capture last round result
      const last = state.scoreboard.roundHistory[state.scoreboard.roundHistory.length - 1];
      if (last) {
        bids.push(last.bidValue);
        if (last.bidMade) made++;
        else failed++;
      }
      engine.startRound();
      continue;
    }

    let actor: Seat | null = null;
    if (state.phase === GamePhase.Bidding) actor = state.auction.toAct;
    else if (state.phase === GamePhase.TrumpSelection) actor = state.contractBidder;
    else if (state.phase === GamePhase.Challenge) actor = state.toAct;
    else if (state.phase === GamePhase.Playing) actor = state.toAct;
    else {
      break;
    }

    if (!actor) break;

    try {
      const decision = decide(level, engine, actor, seed + steps);
      applyAiDecision(engine, actor, decision);
    } catch {
      mistakes++;
      // Attempt recovery: pass / play first legal
      try {
        const st = engine.getState();
        if (st.phase === GamePhase.Bidding) engine.pass(actor);
        else if (st.phase === GamePhase.Challenge) engine.passChallenge(actor);
        else if (st.phase === GamePhase.Playing) {
          const moves = engine.getLegalMoves(actor);
          if (moves[0]) engine.playCard(actor, moves[0]);
          else break;
        } else if (st.phase === GamePhase.TrumpSelection) {
          const suit = st.players[actor].hand[0]?.suit;
          if (suit) engine.chooseTrump(actor, suit);
          else break;
        } else {
          break;
        }
      } catch {
        break;
      }
    }
  }

  const final = engine.getState();
  const last = final.scoreboard.roundHistory[final.scoreboard.roundHistory.length - 1];
  if (last && !bids.includes(last.bidValue) || (last && bids.length < final.scoreboard.roundHistory.length)) {
    // ensure last round counted
  }
  for (const r of final.scoreboard.roundHistory) {
    if (!bids.length || bids.length < final.scoreboard.roundHistory.length) {
      /* recount below */
    }
  }

  const allBids = final.scoreboard.roundHistory.map((r) => r.bidValue);
  made = final.scoreboard.roundHistory.filter((r) => r.bidMade).length;
  failed = final.scoreboard.roundHistory.length - made;

  return {
    winner: final.scoreboard.winner ?? TeamId.NS,
    rounds: final.scoreboard.roundHistory.length,
    bids: allBids,
    made,
    failed,
    mistakes,
    ms: performance.now() - t0,
  };
}

function main(): void {
  const games = Number(process.env.SIM_GAMES ?? 1000);
  const level = (process.env.SIM_LEVEL ?? 'medium') as AiLevel;
  const stats: SimStats = {
    games: 0,
    nsWins: 0,
    ewWins: 0,
    totalRounds: 0,
    totalBids: 0,
    bidSum: 0,
    bidMade: 0,
    bidFailed: 0,
    mistakes: 0,
    durationsMs: [],
  };

  console.log(`Simulating ${games} games at AI level=${level}...`);
  const t0 = performance.now();

  for (let i = 0; i < games; i++) {
    const result = playOneGame(i * 9973 + 42, level);
    stats.games++;
    if (result.winner === TeamId.NS) stats.nsWins++;
    else stats.ewWins++;
    stats.totalRounds += result.rounds;
    stats.totalBids += result.bids.length;
    stats.bidSum += result.bids.reduce((a, b) => a + b, 0);
    stats.bidMade += result.made;
    stats.bidFailed += result.failed;
    stats.mistakes += result.mistakes;
    stats.durationsMs.push(result.ms);

    if ((i + 1) % Math.max(1, Math.floor(games / 10)) === 0) {
      console.log(`  … ${i + 1}/${games}`);
    }
  }

  const elapsed = performance.now() - t0;
  const avgBid = stats.totalBids ? stats.bidSum / stats.totalBids : 0;
  const avgRounds = stats.games ? stats.totalRounds / stats.games : 0;

  console.log('\n═══ Simulation Results ═══');
  console.log(`Games:            ${stats.games}`);
  console.log(`NS win rate:      ${((stats.nsWins / stats.games) * 100).toFixed(2)}%`);
  console.log(`EW win rate:      ${((stats.ewWins / stats.games) * 100).toFixed(2)}%`);
  console.log(`Avg rounds/game:  ${avgRounds.toFixed(2)}`);
  console.log(`Avg bid:          ${avgBid.toFixed(2)}`);
  console.log(`Bids made:        ${stats.bidMade} (${((stats.bidMade / Math.max(1, stats.bidMade + stats.bidFailed)) * 100).toFixed(1)}%)`);
  console.log(`Bids failed:      ${stats.bidFailed}`);
  console.log(`AI mistakes:      ${stats.mistakes}`);
  console.log(`Total time:       ${(elapsed / 1000).toFixed(2)}s`);
  console.log(`Games/sec:        ${(stats.games / (elapsed / 1000)).toFixed(1)}`);
}

main();
