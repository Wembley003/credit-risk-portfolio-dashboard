import type { DpdBucket, PortfolioSnapshot, Segment } from './types.js';
import { DPD_BUCKETS } from './types.js';

/** Pérdida esperada: EL = PD x LGD x EAD. */
export function expectedLoss(segment: Segment): number {
  return segment.pd * segment.lgd * segment.exposure;
}

export function totalExposure(segments: Segment[]): number {
  return segments.reduce((acc, s) => acc + s.exposure, 0);
}

export function totalExpectedLoss(segments: Segment[]): number {
  return segments.reduce((acc, s) => acc + expectedLoss(s), 0);
}

/** PD ponderada por exposición. */
export function weightedPd(segments: Segment[]): number {
  const exposure = totalExposure(segments);
  if (exposure === 0) return 0;
  return segments.reduce((acc, s) => acc + s.pd * s.exposure, 0) / exposure;
}

/** LGD ponderada por exposición. */
export function weightedLgd(segments: Segment[]): number {
  const exposure = totalExposure(segments);
  if (exposure === 0) return 0;
  return segments.reduce((acc, s) => acc + s.lgd * s.exposure, 0) / exposure;
}

/** Exposición agregada por bucket de morosidad. */
export function aggregateBuckets(segments: Segment[]): Record<DpdBucket, number> {
  const totals = {} as Record<DpdBucket, number>;
  for (const bucket of DPD_BUCKETS) {
    totals[bucket] = segments.reduce((acc, s) => acc + s.bucketExposure[bucket], 0);
  }
  return totals;
}

/** Tasa de morosidad: exposición en DPD 30+ / exposición total. */
export function delinquencyRate(segments: Segment[]): number {
  const exposure = totalExposure(segments);
  if (exposure === 0) return 0;
  const buckets = aggregateBuckets(segments);
  return (buckets['30-59'] + buckets['60-89'] + buckets['90+']) / exposure;
}

/** Tasa de cartera vencida (NPL): exposición en 90+ / exposición total. */
export function nplRate(segments: Segment[]): number {
  const exposure = totalExposure(segments);
  if (exposure === 0) return 0;
  return aggregateBuckets(segments)['90+'] / exposure;
}

/** Probabilidad de transición (roll rate) del bucket `from` al bucket `to`. */
export function rollRate(snapshot: PortfolioSnapshot, from: number, to: number): number {
  return snapshot.transitionMatrix[from][to];
}

/** Valida que la matriz de transición sea estocástica por filas. */
export function isValidTransitionMatrix(matrix: number[][], epsilon = 1e-6): boolean {
  if (matrix.length !== 5) return false;
  return matrix.every(
    (row) =>
      row.length === 5 &&
      row.every((p) => p >= 0 && p <= 1) &&
      Math.abs(row.reduce((a, b) => a + b, 0) - 1) <= epsilon,
  );
}

/** Formato de moneda MXN compacto en millones: 1850000000 -> "$1,850 M". */
export function formatMillionsMxn(value: number): string {
  return `$${(value / 1_000_000).toLocaleString('es-MX', { maximumFractionDigits: 0 })} M`;
}

/** Formato de porcentaje: 0.0421 -> "4.2%". */
export function formatPct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** Formato de entero con separador de miles (es-MX). */
export function formatInt(value: number): string {
  return Math.round(value).toLocaleString('es-MX');
}
