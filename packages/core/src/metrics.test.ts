import { describe, expect, it } from 'vitest';
import { generatePortfolioSnapshot } from './generator.js';
import {
  aggregateBuckets,
  delinquencyRate,
  expectedLoss,
  formatMillionsMxn,
  formatPct,
  isValidTransitionMatrix,
  nplRate,
  totalExpectedLoss,
  totalExposure,
  weightedLgd,
  weightedPd,
} from './metrics.js';
import type { Segment } from './types.js';

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'test',
    name: 'Prueba',
    accounts: 1000,
    exposure: 100_000_000,
    pd: 0.05,
    lgd: 0.6,
    bucketExposure: { '0': 90_000_000, '1-29': 5_000_000, '30-59': 2_500_000, '60-89': 1_500_000, '90+': 1_000_000 },
    ifrs9: { stage1: 0.9, stage2: 0.07, stage3: 0.03 },
    ...overrides,
  };
}

describe('expectedLoss', () => {
  it('calcula EL = PD x LGD x EAD', () => {
    // 0.05 * 0.6 * 100_000_000 = 3_000_000
    expect(expectedLoss(makeSegment())).toBe(3_000_000);
  });

  it('es cero si PD es cero', () => {
    expect(expectedLoss(makeSegment({ pd: 0 }))).toBe(0);
  });
});

describe('totales del portafolio', () => {
  const segments = [makeSegment(), makeSegment({ exposure: 50_000_000, pd: 0.02, lgd: 0.5 })];

  it('suma la exposición', () => {
    expect(totalExposure(segments)).toBe(150_000_000);
  });

  it('suma la pérdida esperada', () => {
    // 3_000_000 + 0.02*0.5*50_000_000 = 3_000_000 + 500_000
    expect(totalExpectedLoss(segments)).toBe(3_500_000);
  });

  it('pondera PD y LGD por exposición', () => {
    expect(weightedPd(segments)).toBeCloseTo((0.05 * 100 + 0.02 * 50) / 150, 6);
    expect(weightedLgd(segments)).toBeCloseTo((0.6 * 100 + 0.5 * 50) / 150, 6);
  });
});

describe('morosidad', () => {
  it('agrega buckets y calcula morosidad 30+ y NPL', () => {
    const segments = [makeSegment()];
    const buckets = aggregateBuckets(segments);
    expect(buckets['0']).toBe(90_000_000);
    expect(buckets['90+']).toBe(1_000_000);
    // (2.5 + 1.5 + 1.0) / 100 = 5%
    expect(delinquencyRate(segments)).toBeCloseTo(0.05, 6);
    expect(nplRate(segments)).toBeCloseTo(0.01, 6);
  });

  it('devuelve 0 con portafolio vacío', () => {
    expect(delinquencyRate([])).toBe(0);
    expect(nplRate([])).toBe(0);
    expect(totalExposure([])).toBe(0);
  });
});

describe('matriz de transición', () => {
  it('la matriz generada es estocástica por filas', () => {
    const snapshot = generatePortfolioSnapshot();
    expect(isValidTransitionMatrix(snapshot.transitionMatrix)).toBe(true);
  });

  it('rechaza una matriz cuyas filas no suman 1', () => {
    const bad = [
      [0.5, 0.5, 0, 0, 0],
      [0.5, 0.5, 0, 0, 0],
      [0.5, 0.5, 0, 0, 0],
      [0.5, 0.5, 0, 0, 0],
      [0.5, 0.4, 0, 0, 0],
    ];
    expect(isValidTransitionMatrix(bad)).toBe(false);
  });
});

describe('formato', () => {
  it('formatea millones de MXN', () => {
    expect(formatMillionsMxn(1_850_000_000)).toBe('$1,850 M');
  });

  it('formatea porcentajes', () => {
    expect(formatPct(0.0421)).toBe('4.2%');
    expect(formatPct(0.0421, 2)).toBe('4.21%');
  });
});
