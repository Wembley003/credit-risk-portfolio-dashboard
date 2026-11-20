import { DPD_BUCKETS, DPD_LABELS, formatPct } from '@credit-risk/core';
import type { CSSProperties } from 'react';

/** Intensidad de color según la probabilidad (verde = alta permanencia en la diagonal). */
function cellStyle(probability: number, isDiagonal: boolean): CSSProperties {
  const alpha = 0.12 + probability * 0.75;
  const background = isDiagonal
    ? `rgba(5, 150, 105, ${alpha})`
    : `rgba(220, 38, 38, ${alpha * 0.85})`;
  return { background, fontWeight: isDiagonal ? 700 : 400 };
}

interface Props {
  matrix: number[][];
}

export function TransitionMatrix({ matrix }: Props) {
  return (
    <div className="chart-card">
      <h3>Matriz de transición de Markov (roll rates)</h3>
      <p className="chart-note">
        Probabilidad de que un crédito migre de un bucket de morosidad a otro en el
        siguiente mes. Cada fila suma 100%.
      </p>
      <div className="table-scroll">
        <table className="matrix-table">
          <thead>
            <tr>
              <th>Desde ↓ / Hacia →</th>
              {DPD_BUCKETS.map((b) => (
                <th key={b}>{DPD_LABELS[b]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={DPD_BUCKETS[i]}>
                <th>{DPD_LABELS[DPD_BUCKETS[i]]}</th>
                {row.map((p, j) => (
                  <td key={j} style={cellStyle(p, i === j)}>
                    {formatPct(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
