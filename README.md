# Credit Risk Portfolio Dashboard

Tablero web de analítica de cartera de crédito, construido con **TypeScript, React + Vite y Recharts**, con una mini API en **Node/Express** y CI + despliegue continuo a **GitHub Pages** con GitHub Actions.

**En vivo:** https://wembley003.github.io/credit-risk-portfolio-dashboard/

**Autor:** Wembley Emmanuel Ibarra Tepato — [github.com/Wembley003](https://github.com/Wembley003)

## Qué muestra

- **Resumen de cartera:** exposición total (EAD), pérdida esperada **EL = PD × LGD × EAD**, PD ponderada, morosidad (DPD 30+) y cartera vencida (90+).
- **Evolución mensual** (dic 2025 – nov 2026) de la pérdida esperada y la morosidad.
- **Pérdida esperada por segmento** (tarjeta de crédito, consumo personal, automotriz, hipotecario, PyME) y distribución de la exposición por bucket de morosidad (0, 1–29, 30–59, 60–89, 90+ DPD).
- **Matriz de transición de Markov** (roll rates) entre buckets de morosidad.
- **Detalle por segmento**, con etapas IFRS 9.
- Capa de datos con **carga asíncrona** y estados de *loading* / *error* (con `?demo=error` se puede ver el estado de error).

## Datos

**Todos los datos son sintéticos**, generados con una semilla fija reproducible (`mulberry32`, semilla `20261117`): misma semilla, mismo portafolio. No hay datos reales de ningún cliente ni de ninguna institución.

La metodología (descomposición EL = PD × LGD × EAD, matrices de transición de Markov con `LAG()` en SQL, buckets DPD) es la misma del proyecto Python [credit-risk-portfolio-analytics](https://github.com/Wembley003/credit-risk-portfolio-analytics).

## Stack

| Parte | Tecnología |
| --- | --- |
| Front | TypeScript, React 19, Vite 7, Recharts 3 |
| Datos | Paquete `@credit-risk/core` (generador con semilla + métricas, con pruebas Vitest) |
| API | Node 22, Express 5, TypeScript (`apps/api`) |
| Calidad | Vitest, ESLint, GitHub Actions (CI) |
| Despliegue | GitHub Actions → GitHub Pages |

## Estructura

```text
apps/
  web/            # App React (Vite) — el tablero
  api/            # Mini API Express con los mismos datos
packages/
  core/           # Generador sintético + métricas (EL, morosidad, roll rates) + pruebas
.github/workflows/
  ci.yml          # build + lint + tests en cada push/PR
  deploy.yml      # build del front y despliegue a GitHub Pages
```

## Correr en local

Requisitos: Node.js 20+ y npm.

```bash
# Instalar dependencias de todo el monorepo
npm install

# Front (http://localhost:5173)
npm run dev -w credit-risk-dashboard-web

# API (http://localhost:4000)
npm run dev -w credit-risk-api

# Build completo y pruebas
npm run build
npm test
```

La API expone: `GET /health`, `GET /api/portfolio`, `GET /api/summary`,
`GET /api/segments`, `GET /api/segments/:id`, `GET /api/transitions`,
`GET /api/monthly` y `GET /api/buckets`.

## Despliegue

Cada push a `main` que toque `apps/web`, `packages/core` o el workflow de despliegue
ejecuta `.github/workflows/deploy.yml`: instala dependencias, construye el front y
publica `apps/web/dist` en GitHub Pages. La URL en vivo es
https://wembley003.github.io/credit-risk-portfolio-dashboard/.
