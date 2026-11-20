import { useCallback, useEffect, useState } from 'react';
import { demoErrorRequested, loadPortfolio } from './data/loader.js';
import type { LoadState } from './data/loader.js';
import { BucketDistribution, MonthlyTrend, SegmentExpectedLoss } from './components/Charts.js';
import { SegmentTable } from './components/SegmentTable.js';
import { SummaryCards } from './components/SummaryCards.js';
import { TransitionMatrix } from './components/TransitionMatrix.js';

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadPortfolio({ fail: demoErrorRequested() })
      .then((data) => setState({ status: 'success', data }))
      .catch((error: unknown) =>
        setState({
          status: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido al cargar la cartera.',
        }),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Tablero de Cartera de Crédito</h1>
          <p className="subtitle">
            Pérdida esperada (EL = PD × LGD × EAD) · Matrices de transición de Markov · Morosidad
            por segmento
          </p>
        </div>
        <button type="button" className="reload-button" onClick={load}>
          Recargar datos
        </button>
      </header>

      <main>
        {state.status === 'loading' && (
          <div className="state-box" role="status">
            <div className="spinner" aria-hidden="true" />
            <p>Cargando la cartera…</p>
          </div>
        )}

        {state.status === 'error' && (
          <div className="state-box error-box" role="alert">
            <p className="error-title">No se pudo cargar el tablero</p>
            <p>{state.error}</p>
            <button type="button" className="reload-button" onClick={load}>
              Intentar de nuevo
            </button>
          </div>
        )}

        {state.status === 'success' && (
          <>
            <SummaryCards segments={state.data.segments} />
            <div className="charts-grid">
              <MonthlyTrend monthly={state.data.monthly} />
              <SegmentExpectedLoss segments={state.data.segments} />
            </div>
            <BucketDistribution segments={state.data.segments} />
            <div className="charts-grid">
              <TransitionMatrix matrix={state.data.transitionMatrix} />
              <SegmentTable segments={state.data.segments} />
            </div>
            <p className="footnote">
              Datos sintéticos con semilla reproducible (semilla {state.data.seed}), generados
              en el navegador — no son datos reales de ningún cliente. Metodología basada en el
              proyecto Python{' '}
              <a
                href="https://github.com/Wembley003/credit-risk-portfolio-analytics"
                target="_blank"
                rel="noreferrer"
              >
                credit-risk-portfolio-analytics
              </a>
              . Los endpoints de la API local están en <code>apps/api</code>.
            </p>
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Autor: Wembley Emmanuel Ibarra Tepato ·{' '}
          <a href="https://github.com/Wembley003" target="_blank" rel="noreferrer">
            github.com/Wembley003
          </a>
        </p>
      </footer>
    </div>
  );
}
