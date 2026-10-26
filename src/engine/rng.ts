/** PRNG seedé (mulberry32), utilisé pour les pétales. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Générateur du prototype, pour le placement des têtes (parité visuelle). */
export function placementRng(seed = 1): () => number {
  let state = seed;
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1) ^ 0x9e3779b9;
    state ^= state >>> 13;
    return (state >>> 0) / 4294967296;
  };
}
