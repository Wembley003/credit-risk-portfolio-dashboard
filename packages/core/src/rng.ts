/**
 * Generador pseudoaleatorio con semilla (mulberry32) para que los datos
 * sintéticos sean reproducibles: misma semilla => mismo portafolio.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Número uniforme en [min, max). */
export function range(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/**
 * Reparte `total` entre `n` partes con pesos aleatorios (suma exacta).
 * Útil para distribuir exposición entre buckets de morosidad.
 */
export function randomSplit(rng: () => number, total: number, weights: number[]): number[] {
  const jittered = weights.map((w) => Math.max(0.001, w * (1 + (rng() - 0.5) * 0.2)));
  const sum = jittered.reduce((a, b) => a + b, 0);
  const raw = jittered.map((w) => (total * w) / sum);
  // Ajuste de redondeo en la última parte para que la suma sea exacta.
  const rounded = raw.map((v) => Math.round(v));
  const diff = Math.round(total) - rounded.reduce((a, b) => a + b, 0);
  rounded[rounded.length - 1] += diff;
  return rounded;
}
