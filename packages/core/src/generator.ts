import { mulberry32, randomSplit, range } from './rng.js';
import type { DpdBucket, MonthPoint, PortfolioSnapshot, Segment } from './types.js';
import { DPD_BUCKETS } from './types.js';

/** Semilla fija: el mismo portafolio en cada ejecución. */
export const DEFAULT_SEED = 20261117;

/** Meses del snapshot: diciembre 2025 a noviembre 2026. */
export const SNAPSHOT_MONTHS: { month: string; label: string }[] = [
  { month: '2025-12', label: 'Dic 2025' },
  { month: '2026-01', label: 'Ene 2026' },
  { month: '2026-02', label: 'Feb 2026' },
  { month: '2026-03', label: 'Mar 2026' },
  { month: '2026-04', label: 'Abr 2026' },
  { month: '2026-05', label: 'May 2026' },
  { month: '2026-06', label: 'Jun 2026' },
  { month: '2026-07', label: 'Jul 2026' },
  { month: '2026-08', label: 'Ago 2026' },
  { month: '2026-09', label: 'Sep 2026' },
  { month: '2026-10', label: 'Oct 2026' },
  { month: '2026-11', label: 'Nov 2026' },
];

interface SegmentSpec {
  id: string;
  name: string;
  accounts: number;
  exposure: number;
  pd: number;
  lgd: number;
  /** Peso de exposición por bucket: [0, 1-29, 30-59, 60-89, 90+]. */
  bucketWeights: number[];
  ifrs9: [number, number, number];
}

const SEGMENT_SPECS: SegmentSpec[] = [
  {
    id: 'tarjeta',
    name: 'Tarjeta de crédito',
    accounts: 48200,
    exposure: 820_000_000,
    pd: 0.062,
    lgd: 0.72,
    bucketWeights: [0.86, 0.07, 0.03, 0.02, 0.02],
    ifrs9: [0.88, 0.09, 0.03],
  },
  {
    id: 'consumo',
    name: 'Consumo personal',
    accounts: 31500,
    exposure: 640_000_000,
    pd: 0.041,
    lgd: 0.58,
    bucketWeights: [0.9, 0.05, 0.022, 0.013, 0.015],
    ifrs9: [0.91, 0.07, 0.02],
  },
  {
    id: 'automotriz',
    name: 'Automotriz',
    accounts: 12800,
    exposure: 910_000_000,
    pd: 0.028,
    lgd: 0.42,
    bucketWeights: [0.93, 0.035, 0.016, 0.009, 0.01],
    ifrs9: [0.93, 0.055, 0.015],
  },
  {
    id: 'hipotecario',
    name: 'Hipotecario',
    accounts: 9400,
    exposure: 1_850_000_000,
    pd: 0.014,
    lgd: 0.28,
    bucketWeights: [0.96, 0.02, 0.009, 0.005, 0.006],
    ifrs9: [0.96, 0.032, 0.008],
  },
  {
    id: 'pyme',
    name: 'PyME',
    accounts: 6700,
    exposure: 1_120_000_000,
    pd: 0.053,
    lgd: 0.61,
    bucketWeights: [0.88, 0.06, 0.027, 0.016, 0.017],
    ifrs9: [0.89, 0.085, 0.025],
  },
];

/**
 * Matriz base de transición de Markov entre buckets DPD.
 * Fila = bucket origen, columna = bucket destino. Cada fila suma 1.
 * La mayoría de la cartera se queda en su bucket; hay migración hacia
 * adelante (deterioro) y una parte se cura hacia buckets mejores.
 */
const BASE_TRANSITION: number[][] = [
  [0.94, 0.045, 0.01, 0.003, 0.002],
  [0.38, 0.42, 0.13, 0.04, 0.03],
  [0.12, 0.28, 0.36, 0.15, 0.09],
  [0.06, 0.1, 0.24, 0.34, 0.26],
  [0.03, 0.02, 0.05, 0.14, 0.76],
];

function buildSegments(rng: () => number): Segment[] {
  return SEGMENT_SPECS.map((spec) => {
    const exposure = Math.round(spec.exposure * (1 + (rng() - 0.5) * 0.04));
    const pd = Math.min(0.95, Math.max(0.001, spec.pd * (1 + (rng() - 0.5) * 0.08)));
    const lgd = Math.min(0.95, Math.max(0.05, spec.lgd * (1 + (rng() - 0.5) * 0.06)));
    const split = randomSplit(rng, exposure, spec.bucketWeights);
    const bucketExposure = {} as Record<DpdBucket, number>;
    DPD_BUCKETS.forEach((bucket, i) => {
      bucketExposure[bucket] = split[i];
    });
    const ifrs9Jitter = spec.ifrs9.map((s) => Math.max(0.001, s * (1 + (rng() - 0.5) * 0.05)));
    const ifrs9Sum = ifrs9Jitter.reduce((a, b) => a + b, 0);
    return {
      id: spec.id,
      name: spec.name,
      accounts: spec.accounts + Math.round((rng() - 0.5) * 400),
      exposure,
      pd,
      lgd,
      bucketExposure,
      ifrs9: {
        stage1: ifrs9Jitter[0] / ifrs9Sum,
        stage2: ifrs9Jitter[1] / ifrs9Sum,
        stage3: ifrs9Jitter[2] / ifrs9Sum,
      },
    };
  });
}

function buildTransitionMatrix(rng: () => number): number[][] {
  return BASE_TRANSITION.map((row) => {
    const jittered = row.map((p) => Math.max(0.0005, p * (1 + (rng() - 0.5) * 0.1)));
    const sum = jittered.reduce((a, b) => a + b, 0);
    return jittered.map((p) => p / sum);
  });
}

function buildMonthly(rng: () => number, segments: Segment[]): MonthPoint[] {
  const baseExposure = segments.reduce((a, s) => a + s.exposure, 0);
  const baseEL = segments.reduce((a, s) => a + s.pd * s.lgd * s.exposure, 0);
  const baseDelinq =
    segments.reduce(
      (a, s) => a + s.bucketExposure['30-59'] + s.bucketExposure['60-89'] + s.bucketExposure['90+'],
      0,
    ) / baseExposure;
  const baseNpl =
    segments.reduce((a, s) => a + s.bucketExposure['90+'], 0) / baseExposure;

  return SNAPSHOT_MONTHS.map((m, i) => {
    // Deriva mensual suave: crecimiento de cartera y estacionalidad de la mora
    // (peor en enero, tras las fiestas; mejora hacia mitad de año).
    const growth = 1 + 0.004 * i + range(rng, -0.002, 0.002);
    const seasonal = 1 + 0.06 * Math.sin((i / 12) * Math.PI * 2 + 1.2);
    const delinquencyRate = Math.min(0.2, Math.max(0.005, baseDelinq * seasonal * (1 + range(rng, -0.03, 0.03))));
    const nplRate = Math.min(0.08, Math.max(0.002, baseNpl * seasonal * (1 + range(rng, -0.03, 0.03))));
    const exposure = Math.round(baseExposure * growth);
    const expectedLoss = Math.round(baseEL * growth * seasonal * (1 + range(rng, -0.02, 0.02)));
    return { month: m.month, label: m.label, exposure, expectedLoss, delinquencyRate, nplRate };
  });
}

/**
 * Genera el snapshot completo del portafolio sintético.
 * Determinista: misma semilla => mismo snapshot.
 */
export function generatePortfolioSnapshot(seed: number = DEFAULT_SEED): PortfolioSnapshot {
  const rng = mulberry32(seed);
  const segments = buildSegments(rng);
  const transitionMatrix = buildTransitionMatrix(rng);
  const monthly = buildMonthly(rng, segments);
  return {
    generatedAt: '2026-11-17T00:00:00.000Z',
    seed,
    currency: 'MXN',
    months: SNAPSHOT_MONTHS.map((m) => m.month),
    segments,
    transitionMatrix,
    monthly,
  };
}
