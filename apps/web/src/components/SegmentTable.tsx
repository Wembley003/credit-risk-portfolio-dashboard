import {
  delinquencyRate,
  expectedLoss,
  formatInt,
  formatMillionsMxn,
  formatPct,
} from '@credit-risk/core';
import type { Segment } from '@credit-risk/core';

interface Props {
  segments: Segment[];
}

export function SegmentTable({ segments }: Props) {
  return (
    <div className="chart-card">
      <h3>Detalle por segmento</h3>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Segmento</th>
              <th>Cuentas</th>
              <th>Exposición (EAD)</th>
              <th>PD</th>
              <th>LGD</th>
              <th>Pérdida esperada (EL)</th>
              <th>Morosidad 30+</th>
              <th>IFRS 9 (S1 / S2 / S3)</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{formatInt(s.accounts)}</td>
                <td>{formatMillionsMxn(s.exposure)}</td>
                <td>{formatPct(s.pd, 2)}</td>
                <td>{formatPct(s.lgd)}</td>
                <td>{formatMillionsMxn(expectedLoss(s))}</td>
                <td>{formatPct(delinquencyRate([s]))}</td>
                <td>
                  {formatPct(s.ifrs9.stage1, 0)} / {formatPct(s.ifrs9.stage2, 0)} /{' '}
                  {formatPct(s.ifrs9.stage3, 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
