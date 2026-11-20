import { generatePortfolioSnapshot } from '@credit-risk/core';
import type { PortfolioSnapshot } from '@credit-risk/core';

export type LoadState =
  | { status: 'loading' }
  | { status: 'success'; data: PortfolioSnapshot }
  | { status: 'error'; error: string };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Carga asíncrona del snapshot de la cartera (simula una llamada a la API).
 * Con `?demo=error` en la URL se fuerza el estado de error para demostrar
 * el manejo de fallos. En producción este loader llamaría a /api/portfolio.
 */
export async function loadPortfolio(options: { fail?: boolean } = {}): Promise<PortfolioSnapshot> {
  await delay(600);
  if (options.fail) {
    throw new Error('No se pudo cargar la cartera. Revisa tu conexión e inténtalo de nuevo.');
  }
  return generatePortfolioSnapshot();
}

/** Lee `?demo=error` de la URL actual (solo en el navegador). */
export function demoErrorRequested(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('demo') === 'error';
}
