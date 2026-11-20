import { describe, expect, it } from 'vitest';
import { loadPortfolio } from './loader.js';

describe('loadPortfolio', () => {
  it('resuelve con el snapshot de la cartera', async () => {
    const data = await loadPortfolio();
    expect(data.segments).toHaveLength(5);
    expect(data.monthly).toHaveLength(12);
    expect(data.currency).toBe('MXN');
  });

  it('rechaza con un mensaje claro cuando se fuerza el error', async () => {
    await expect(loadPortfolio({ fail: true })).rejects.toThrow('No se pudo cargar la cartera');
  });
});
