import cors from 'cors';
import express from 'express';
import {
  aggregateBuckets,
  delinquencyRate,
  formatMillionsMxn,
  generatePortfolioSnapshot,
  nplRate,
  totalExpectedLoss,
  totalExposure,
  weightedLgd,
  weightedPd,
} from '@credit-risk/core';

const app = express();
app.use(cors());
app.use(express.json());

/** El snapshot se genera una vez al arrancar el servidor (semilla fija). */
const snapshot = generatePortfolioSnapshot();

app.get('/', (_req, res) => {
  res.json({
    service: 'credit-risk-portfolio-api',
    version: '1.0.0',
    currency: snapshot.currency,
    seed: snapshot.seed,
    endpoints: [
      'GET /health',
      'GET /api/portfolio',
      'GET /api/summary',
      'GET /api/segments',
      'GET /api/segments/:id',
      'GET /api/transitions',
      'GET /api/monthly',
      'GET /api/buckets',
    ],
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', generatedAt: snapshot.generatedAt });
});

/** Snapshot completo del portafolio sintético. */
app.get('/api/portfolio', (_req, res) => {
  res.json(snapshot);
});

app.get('/api/summary', (_req, res) => {
  res.json({
    currency: snapshot.currency,
    totalExposure: totalExposure(snapshot.segments),
    totalExposureFormatted: formatMillionsMxn(totalExposure(snapshot.segments)),
    totalExpectedLoss: totalExpectedLoss(snapshot.segments),
    totalExpectedLossFormatted: formatMillionsMxn(totalExpectedLoss(snapshot.segments)),
    weightedPd: weightedPd(snapshot.segments),
    weightedLgd: weightedLgd(snapshot.segments),
    delinquencyRate: delinquencyRate(snapshot.segments),
    nplRate: nplRate(snapshot.segments),
    segments: snapshot.segments.length,
    months: snapshot.months,
  });
});

app.get('/api/segments', (_req, res) => {
  res.json(snapshot.segments);
});

app.get('/api/segments/:id', (req, res) => {
  const segment = snapshot.segments.find((s) => s.id === req.params.id);
  if (!segment) {
    res.status(404).json({ error: `Segmento no encontrado: ${req.params.id}` });
    return;
  }
  res.json(segment);
});

app.get('/api/transitions', (_req, res) => {
  res.json({
    buckets: ['0', '1-29', '30-59', '60-89', '90+'],
    matrix: snapshot.transitionMatrix,
  });
});

app.get('/api/monthly', (_req, res) => {
  res.json(snapshot.monthly);
});

app.get('/api/buckets', (_req, res) => {
  res.json(aggregateBuckets(snapshot.segments));
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`credit-risk-portfolio-api escuchando en http://localhost:${port}`);
});
