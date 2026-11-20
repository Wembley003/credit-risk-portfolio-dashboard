/**
 * Tipos del dominio de analítica de cartera de crédito.
 * Buckets de morosidad (DPD = days past due) iguales a los del proyecto
 * Python credit-risk-portfolio-analytics.
 */
export type DpdBucket = '0' | '1-29' | '30-59' | '60-89' | '90+';

export const DPD_BUCKETS: DpdBucket[] = ['0', '1-29', '30-59', '60-89', '90+'];

export const DPD_LABELS: Record<DpdBucket, string> = {
  '0': 'Al corriente (0 DPD)',
  '1-29': '1–29 DPD',
  '30-59': '30–59 DPD',
  '60-89': '60–89 DPD',
  '90+': '90+ DPD',
};

/** Etapas IFRS 9: participación de la exposición en cada etapa. */
export interface Ifrs9Stages {
  stage1: number;
  stage2: number;
  stage3: number;
}

export interface Segment {
  id: string;
  name: string;
  accounts: number;
  /** Exposición (EAD) en MXN. */
  exposure: number;
  /** Probabilidad de incumplimiento (0..1). */
  pd: number;
  /** Pérdida dado el incumplimiento (0..1). */
  lgd: number;
  /** Exposición por bucket de morosidad; suma = exposure. */
  bucketExposure: Record<DpdBucket, number>;
  ifrs9: Ifrs9Stages;
}

export interface MonthPoint {
  /** 'YYYY-MM' */
  month: string;
  /** Etiqueta en español, p. ej. 'Dic 2025'. */
  label: string;
  exposure: number;
  expectedLoss: number;
  /** Exposición en DPD 30+ / exposición total. */
  delinquencyRate: number;
  /** Exposición en 90+ / exposición total. */
  nplRate: number;
}

export interface PortfolioSnapshot {
  generatedAt: string;
  seed: number;
  currency: 'MXN';
  /** Meses cubiertos, de más antiguo a más reciente. */
  months: string[];
  segments: Segment[];
  /** Matriz de transición de Markov 5x5 (filas = bucket origen, columnas = destino). */
  transitionMatrix: number[][];
  monthly: MonthPoint[];
}
