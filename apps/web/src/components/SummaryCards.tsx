import {
  delinquencyRate,
  formatMillionsMxn,
  formatPct,
  nplRate,
  totalExpectedLoss,
  totalExposure,
  weightedPd,
} from '@credit-risk/core';
import type { Segment } from '@credit-risk/core';

interface Props {
  segments: Segment[];
}

export function SummaryCards({ segments }: Props) {
  const cards = [
    {
      label: 'Exposición total (EAD)',
      value: formatMillionsMxn(totalExposure(segments)),
      note: 'Suma de la exposición de los 5 segmentos',
    },
    {
      label: 'Pérdida esperada (EL)',
      value: formatMillionsMxn(totalExpectedLoss(segments)),
      note: 'EL = PD × LGD × EAD',
    },
    {
      label: 'PD ponderada',
      value: formatPct(weightedPd(segments), 2),
      note: 'Ponderada por exposición',
    },
    {
      label: 'Morosidad (DPD 30+)',
      value: formatPct(delinquencyRate(segments)),
      note: 'Exposición en 30+ DPD / exposición total',
    },
    {
      label: 'Cartera vencida (90+)',
      value: formatPct(nplRate(segments)),
      note: 'Exposición en 90+ DPD / exposición total',
    },
  ];

  return (
    <section className="kpi-grid" aria-label="Indicadores clave de la cartera">
      {cards.map((card) => (
        <article key={card.label} className="kpi-card">
          <h3>{card.label}</h3>
          <p className="kpi-value">{card.value}</p>
          <p className="kpi-note">{card.note}</p>
        </article>
      ))}
    </section>
  );
}
