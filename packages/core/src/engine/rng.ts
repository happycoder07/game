/**
 * Mulberry32 — small seeded PRNG for deterministic shuffles / AI / sims.
 */
export function createSeededRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: () => number, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

export function pickRandom<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) throw new Error('Cannot pick from empty array');
  return items[Math.floor(rng() * items.length)]!;
}
