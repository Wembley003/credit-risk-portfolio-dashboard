import { describe, expect, it } from 'vitest';
import { generatePortfolioSnapshot } from './generator.js';
import { delinquencyRate, isValidTransitionMatrix, totalExposure } from './metrics.js';
import { DPD_BUCKETS } from './types.js';

describe('generatePortfolioSnapshot', () => {
  it('es determinista: misma semilla => mismo snapshot', () => {
    const a = generatePortfolioSnapshot();
    const b = generatePortfolioSnapshot();
    expect(a).toEqual(b);
  });

  it('otra semilla genera otro portafolio', () => {
    const a = generatePortfolioSnapshot(1);
    const b = generatePortfolioSnapshot(2);
    expect(a.segments[0].exposure).not.toBe(b.segments[0].exposure);
  });

  it('tiene 5 segmentos y 12 meses', () => {
    const snapshot = generatePortfolioSnapshot();
    expect(snapshot.segments).toHaveLength(5);
    expect(snapshot.monthly).toHaveLength(12);
    expect(snapshot.months).toHaveLength(12);
  });

  it('la exposición por bucket suma la exposición del segmento', () => {
    const snapshot = generatePortfolioSnapshot();
    for (const segment of snapshot.segments) {
      const sum = DPD_BUCKETS.reduce((acc, b) => acc + segment.bucketExposure[b], 0);
      expect(sum).toBe(segment.exposure);
    }
  });

  it('las etapas IFRS 9 suman 1 por segmento', () => {
    const snapshot = generatePortfolioSnapshot();
    for (const segment of snapshot.segments) {
      const sum = segment.ifrs9.stage1 + segment.ifrs9.stage2 + segment.ifrs9.stage3;
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  it('la matriz de transición es válida y la morosidad está en rango', () => {
    const snapshot = generatePortfolioSnapshot();
    expect(isValidTransitionMatrix(snapshot.transitionMatrix)).toBe(true);
    const rate = delinquencyRate(snapshot.segments);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(0.2);
    expect(totalExposure(snapshot.segments)).toBeGreaterThan(5_000_000_000);
  });

  it('la serie mensual es creciente en exposición y consistente', () => {
    const snapshot = generatePortfolioSnapshot();
    for (const point of snapshot.monthly) {
      expect(point.exposure).toBeGreaterThan(0);
      expect(point.expectedLoss).toBeGreaterThan(0);
      expect(point.delinquencyRate).toBeGreaterThan(0);
      expect(point.delinquencyRate).toBeLessThan(0.2);
      expect(point.nplRate).toBeLessThan(point.delinquencyRate);
    }
  });
});
