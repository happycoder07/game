#!/usr/bin/env node
/**
 * Interactive CLI for Twenty-Nine.
 * Human sits South; three AI opponents (configurable level).
 */
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import {
  createPlayer,
  GameEngine,
  Seat,
  Suit,
  GamePhase,
  seatDisplayName,
  suitSymbol,
  suitDisplayName,
  decide,
  applyAiDecision,
  runAiUntilHuman,
  type AiLevel,
  getAdjustedTarget,
} from '@twenty-nine/core';

const AI_LEVEL: AiLevel = (process.env.AI_LEVEL as AiLevel) || 'medium';

function createTable() {
  return [
    createPlayer({ id: 'n', name: 'North (AI)', seat: Seat.North, kind: 'ai', aiLevel: AI_LEVEL }),
    createPlayer({ id: 'e', name: 'East (AI)', seat: Seat.East, kind: 'ai', aiLevel: AI_LEVEL }),
    createPlayer({ id: 's', name: 'You', seat: Seat.South, kind: 'human' }),
    createPlayer({ id: 'w', name: 'West (AI)', seat: Seat.West, kind: 'ai', aiLevel: AI_LEVEL }),
  ];
}

function printBanner(): void {
  console.log(chalk.green.bold('\n╔══════════════════════════════════╗'));
  console.log(chalk.green.bold('║     TWENTY-NINE  (29)  CLI       ║'));
  console.log(chalk.green.bold('╚══════════════════════════════════╝\n'));
  console.log(`AI level: ${chalk.cyan(AI_LEVEL)}  |  You are ${chalk.yellow('South')}\n`);
}

function renderHand(cards: { id: string; toString(): string }[], legal: string[]): string {
  return cards
    .map((c, i) => {
      const n = `${i + 1}:${c.toString()}`;
      return legal.includes(c.id) ? chalk.green(n) : chalk.gray(n);
    })
    .join('  ');
}

function printState(engine: GameEngine): void {
  const st = engine.getState();
  console.log(chalk.dim('─'.repeat(50)));
  console.log(
    `Phase: ${chalk.magenta(st.phase)}  Round: ${st.roundNumber}  Dealer: ${seatDisplayName(st.dealer)}`,
  );
  console.log(
    `Score  NS: ${chalk.bold(String(st.scoreboard.ns))}  EW: ${chalk.bold(String(st.scoreboard.ew))}`,
  );
  if (st.contractBid !== null) {
    const target = getAdjustedTarget(st);
    console.log(
      `Contract: ${st.contractBid} by ${seatDisplayName(st.contractBidder!)} (${st.contractTeam})  target=${target}`,
    );
  }
  if (st.trump.suit) {
    const t = st.trump.revealed
      ? chalk.red.bold(`${suitDisplayName(st.trump.suit)} ${suitSymbol(st.trump.suit)}`)
      : chalk.dim('(hidden)');
    console.log(`Trump: ${t}`);
  }
  console.log(`Points this round  NS: ${st.pointsNS}  EW: ${st.pointsEW}`);

  if (st.currentTrick && st.currentTrick.plays.length > 0) {
    console.log(
      'Trick: ' +
        st.currentTrick.plays
          .map((p) => `${seatDisplayName(p.seat)}:${p.card.toString()}`)
          .join('  '),
    );
  }

  const legal =
    st.phase === GamePhase.Playing ? engine.getLegalMoves(Seat.South) : [];
  console.log(`Your hand: ${renderHand(st.players[Seat.South].hand, legal)}`);
}

async function prompt(rl: readline.Interface, q: string): Promise<string> {
  return (await rl.question(q)).trim();
}

async function handleHuman(
  engine: GameEngine,
  rl: readline.Interface,
): Promise<boolean> {
  const st = engine.getState();

  if (st.phase === GamePhase.Finished) {
    console.log(chalk.yellow.bold(`\nGame over! Winner: ${st.scoreboard.winner}`));
    return false;
  }

  if (st.phase === GamePhase.RoundEnd || st.phase === GamePhase.Waiting) {
    const last = st.scoreboard.roundHistory[st.scoreboard.roundHistory.length - 1];
    if (last) {
      console.log(
        chalk.cyan(
          `\nRound result: bid ${last.bidValue} (target ${last.adjustedTarget}) — ${
            last.bidMade ? 'MADE' : 'SET'
          } (${last.gamePointDelta > 0 ? '+' : ''}${last.gamePointDelta})`,
        ),
      );
    }
    const a = await prompt(rl, 'Deal next round? [Y/n] ');
    if (a.toLowerCase() === 'n') return false;
    engine.startRound();
    return true;
  }

  if (st.phase === GamePhase.Bidding && st.auction.toAct === Seat.South) {
    const legal = engine.getLegalBids(Seat.South);
    console.log(`Legal bids: ${legal.join(', ')} or pass`);
    const a = await prompt(rl, 'Bid (number) or p to pass: ');
    if (a === 'p' || a === 'pass') engine.pass(Seat.South);
    else engine.bid(Seat.South, Number(a));
    return true;
  }

  if (st.phase === GamePhase.TrumpSelection && st.contractBidder === Seat.South) {
    console.log('Choose trump: S H D C');
    const a = (await prompt(rl, 'Trump suit: ')).toUpperCase();
    const map: Record<string, Suit> = {
      S: Suit.Spades,
      H: Suit.Hearts,
      D: Suit.Diamonds,
      C: Suit.Clubs,
    };
    const suit = map[a];
    if (!suit) {
      console.log(chalk.red('Invalid suit'));
      return true;
    }
    engine.chooseTrump(Seat.South, suit);
    return true;
  }

  if (st.phase === GamePhase.Challenge && st.toAct === Seat.South) {
    const a = await prompt(rl, 'Challenge: [d]ouble [r]edouble [p]ass: ');
    if (a === 'd') engine.double(Seat.South);
    else if (a === 'r') engine.redouble(Seat.South);
    else engine.passChallenge(Seat.South);
    return true;
  }

  if (st.phase === GamePhase.Playing && st.toAct === Seat.South) {
    const legal = engine.getLegalMoves(Seat.South);
    const hand = st.players[Seat.South].hand;
    console.log('Commands: number to play, r=reveal, m=marriage, u=undo');
    const a = await prompt(rl, 'Your move: ');
    if (a === 'u') {
      engine.undo();
      return true;
    }
    if (a === 'r') {
      engine.revealTrump(Seat.South, 'voluntary');
      return true;
    }
    if (a === 'm') {
      engine.declareMarriage(Seat.South);
      return true;
    }
    const idx = Number(a) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= hand.length) {
      console.log(chalk.red('Invalid selection'));
      return true;
    }
    const card = hand[idx]!;
    if (!legal.includes(card.id)) {
      console.log(chalk.red('Illegal card — must follow suit'));
      return true;
    }
    engine.playCard(Seat.South, card.id);
    return true;
  }

  // Not our turn — should not happen if AI runner works
  return true;
}

async function main(): Promise<void> {
  printBanner();
  const rl = readline.createInterface({ input, output });
  const engine = new GameEngine(createTable(), { allowDouble: true });

  engine.subscribe((ev) => {
    if (ev.type === 'TrickWon') {
      console.log(
        chalk.blue(`Trick ${ev.trickIndex + 1} won by ${seatDisplayName(ev.winner)} (+${ev.points})`),
      );
    } else if (ev.type === 'TrumpRevealed') {
      console.log(chalk.red.bold(`Trump revealed: ${suitDisplayName(ev.suit)} ${suitSymbol(ev.suit)}`));
    } else if (ev.type === 'MarriageDeclared') {
      console.log(chalk.yellow(`Marriage! New target: ${ev.newTarget}`));
    } else if (ev.type === 'AuctionComplete') {
      console.log(
        chalk.green(`Auction won by ${seatDisplayName(ev.winner)} at ${ev.bid}`),
      );
    }
  });

  engine.startRound();

  let playing = true;
  while (playing) {
    runAiUntilHuman(engine, (seat) => seat === Seat.South);
    printState(engine);
    try {
      playing = await handleHuman(engine, rl);
    } catch (e) {
      console.log(chalk.red(e instanceof Error ? e.message : String(e)));
    }

    // After human action, let AI continue
    if (playing) {
      try {
        runAiUntilHuman(engine, (seat) => seat === Seat.South);
      } catch (e) {
        // AI fallback: pick legal
        const st = engine.getState();
        let actor: Seat | null = st.toAct ?? st.auction.toAct;
        if (st.phase === GamePhase.TrumpSelection) actor = st.contractBidder;
        if (actor && actor !== Seat.South) {
          try {
            const d = decide(AI_LEVEL, engine, actor);
            applyAiDecision(engine, actor, d);
          } catch {
            /* ignore */
          }
        }
        console.log(chalk.red(e instanceof Error ? e.message : String(e)));
      }
    }
  }

  rl.close();
  console.log(chalk.green('\nThanks for playing Twenty-Nine!\n'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
