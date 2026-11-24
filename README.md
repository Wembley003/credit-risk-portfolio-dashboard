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
scripts/
  export_portfolio.py  # Excel (5 hojas + 2 pivotes), SQLite y CSV para Tableau
  pivot_table.py       # tablas dinámicas nativas de Excel (openpyxl)
  test_export.py / test_access.py / test_layers.py  # pruebas de Python (sin API)
access/           # .accdb real + CSV/schema + constructor (Jackcess)
sql/
  schema_access.sql    # DDL para Access (todo TEXT, como la SQLite)
.github/workflows/
  ci.yml          # build + lint + tests en cada push/PR
  deploy.yml      # build del front y despliegue a GitHub Pages
```

## Capas

Tres capas; Bronce/Plata/Oro **no** aplica aquí (no hay un ETL con
staging crudo → limpio → agregado: el snapshot se genera sintético en
memoria y se sirve tal cual, así que forzarlo sería ponerle nombres a
algo que no existe). El monorepo ya separa las capas por paquete:

- **Capa del cliente (presentación)** — `apps/web` (React: el tablero
  que el usuario ve y toca) y `apps/api` (Express: sirve el snapshot y
  los agregados). Ni la web ni la API tocan SQLite directo.
- **Capa de reglas de negocio** — `packages/core`: las fórmulas
  (EL = PD x LGD x EAD, PD/LGD ponderadas, morosidad, buckets, matriz
  de transición) y el generador sintético. Pura matemática sobre el
  snapshot que le pasan: no conoce el servidor ni la web.
- **Capa de consultas o análisis** — `scripts/export_portfolio.py`
  (del snapshot de la API a SQLite, Excel y CSV para Tableau) más
  `sql/schema_access.sql` y `access/`. La tecnología aquí es la API +
  Python, no SQL directo en la web: el script consume la API por HTTP,
  nunca importando su código. Las métricas y los agregados son el
  análisis.

Las pruebas de `scripts/test_layers.py` (4 pruebas) verifican que las
capas no se mezclen (análisis estático de imports en TypeScript y
Python).

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

## Exportar el portafolio a Excel, SQLite y CSV (nuevo)

El tablero vive en el navegador, pero hay preguntas que se responden
mejor fuera de él. `scripts/export_portfolio.py` le pide el snapshot
a la API local — la misma que alimenta al tablero, así que los números
son idénticos a los de la pantalla — y lo deja en tres formatos:
un libro de Excel (`portfolio.xlsx`), una base SQLite
(`portfolio.sqlite`) y dos CSV listos para importar en Tableau
(`tableau_segmentos.csv`, `tableau_mensual.csv`). Lo de Tableau son
solo archivos que Tableau puede leer: no hay conector ni tablero
construido. La API tiene que estar corriendo.

```bash
npm run dev -w credit-risk-api   # terminal 1: la API en :4000
./scripts/export_portfolio.sh    # terminal 2: exporta a exports/
```

Las cifras se verifican solas: la exposición total del Excel tiene
que ser la misma que la del tablero ($5,372,000,413 MXN) y la suma de
los buckets tiene que dar lo mismo. Las pruebas de Python viven en
`scripts/test_export.py` (7 pruebas, con datos de juguete que se
pueden verificar a mano), `scripts/test_access.py` (3 pruebas: el
volcado a Access y el .accdb real) y `scripts/test_layers.py`
(4 pruebas: las capas no se mezclan). Las dependencias de Python están en
`scripts/requirements.txt` (pandas, openpyxl, pytest).

## Tablas dinámicas y Access

El Excel lleva además dos **tablas dinámicas nativas**: «Dinámica por
segmento» (exposición, pérdida esperada y cuentas por segmento) y
«Dinámica por mes» (exposición, pérdida esperada y morosidad promedio
por mes —la morosidad se promedia, no se suma—). Son nativas
—definición, caché y registros dentro del `.xlsx`—, así que Excel las
filtra y recalcula al abrir; si una tabla está vacía, su pivote se
salta sin romper la exportación. El helper que las construye está en
`scripts/pivot_table.py` y se aplica dentro de `write_excel` antes de
que pandas cierre el libro.

Y hay una base **real** de Access en `access/credit-risk-dashboard.accdb`
(formato ACE14): las 5 tablas del portafolio con sus filas, lista para
abrir en Access. Se regenera con `./access/build_access.sh
exports/portfolio.sqlite credit-risk-dashboard.accdb` (vuelca a CSV +
schema con `dump_access.py`, construye con Jackcess en Java y verifica
con mdbtools); los detalles, la nota sobre subir el `.accdb` binario
por web y la advertencia honesta de que la SQLite guarda todo como
TEXT están en `access/README.md`. El DDL de referencia está en
`sql/schema_access.sql`.

## Despliegue

Cada push a `main` que toque `apps/web`, `packages/core` o el workflow de despliegue
ejecuta `.github/workflows/deploy.yml`: instala dependencias, construye el front y
publica `apps/web/dist` en GitHub Pages. La URL en vivo es
https://wembley003.github.io/credit-risk-portfolio-dashboard/.
