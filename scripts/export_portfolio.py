"""
Capa: Consultas o análisis — del snapshot de la API a Excel, SQLite y CSV para Tableau.
Exporta el portafolio del dashboard a Excel, SQLite y CSV para Tableau.

El tablero vive en el navegador y la API vive en Node, pero hay
preguntas que se responden mejor fuera del navegador: ¿cómo se compara
este mes contra el anterior en una tabla?, ¿qué pasa si junto estos
datos con los de otro sistema? Para eso está este script: le pide el
snapshot a la API local (la misma que alimenta al tablero, así que los
números son idénticos a los que se ven en pantalla) y lo deja en tres
formatos:

- Excel (``portfolio.xlsx``): un libro con el resumen, los segmentos,
  la serie mensual, los buckets y la matriz de transición.
- SQLite (``portfolio.sqlite``): las mismas tablas, para consultarlas
  con SQL o para que las lea otro programa.
- CSV para Tableau (``tableau_segmentos.csv`` y
  ``tableau_mensual.csv``): los datos ya en forma tabular, listos para
  importar. Esto NO es integración con Tableau: no hay conector ni
  tablero construido, solo archivos que Tableau puede leer.

La API tiene que estar corriendo (``npm run dev -w credit-risk-api``,
puerto 4000). Si no responde, el script lo dice claro y sale con
código 1 en vez de inventar un archivo vacío.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import urllib.error
import urllib.request
from pathlib import Path

import pandas as pd

try:
    # Al correrlo como script (python scripts/export_portfolio.py) o
    # desde pytest en scripts/, este directorio ya está en sys.path.
    from pivot_table import add_pivot_table
except ImportError:  # pragma: no cover - importado como paquete
    import sys as _sys

    _sys.path.insert(0, str(Path(__file__).resolve().parent))
    from pivot_table import add_pivot_table

__all__ = ["build_tables", "export", "fetch_json"]

DPD_BUCKETS = ["0", "1-29", "30-59", "60-89", "90+"]
DPD_LABELS = {
    "0": "Al corriente (0 DPD)",
    "1-29": "1–29 DPD",
    "30-59": "30–59 DPD",
    "60-89": "60–89 DPD",
    "90+": "90+ DPD",
}


def fetch_json(base_url, path, timeout=10):
    """Pide un JSON a la API. Si no responde, levanta un error claro."""
    url = base_url.rstrip("/") + path
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise ConnectionError(
            f"no se pudo contactar la API en {url}: {exc.reason}. "
            "Arranca la API con: npm run dev -w credit-risk-api"
        ) from exc


def build_tables(snapshot, summary):
    """Convierte el snapshot JSON en DataFrames listos para exportar.

    La pérdida esperada por segmento se calcula aquí como
    EL = EAD x PD x LGD, igual que en el tablero: si el Excel dijera
    otra cosa que la pantalla, el script estaría mintiendo.
    """
    segmentos = []
    for seg in snapshot["segments"]:
        buckets = seg["bucketExposure"]
        segmentos.append(
            {
                "segmento": seg["name"],
                "segmento_id": seg["id"],
                "cuentas": seg["accounts"],
                "exposicion": seg["exposure"],
                "pd": seg["pd"],
                "lgd": seg["lgd"],
                # EL = PD x LGD x EAD: la misma descomposición del tablero.
                "perdida_esperada": seg["exposure"] * seg["pd"] * seg["lgd"],
                "bucket_0": buckets["0"],
                "bucket_1_29": buckets["1-29"],
                "bucket_30_59": buckets["30-59"],
                "bucket_60_89": buckets["60-89"],
                "bucket_90_mas": buckets["90+"],
                "ifrs9_etapa1": seg["ifrs9"]["stage1"],
                "ifrs9_etapa2": seg["ifrs9"]["stage2"],
                "ifrs9_etapa3": seg["ifrs9"]["stage3"],
            }
        )
    df_segmentos = pd.DataFrame(segmentos)

    df_mensual = pd.DataFrame(
        [
            {
                "mes": m["month"],
                "etiqueta": m["label"],
                "exposicion": m["exposure"],
                "perdida_esperada": m["expectedLoss"],
                "morosidad": m["delinquencyRate"],
                "npl": m["nplRate"],
            }
            for m in snapshot["monthly"]
        ]
    )

    # Los buckets agregados son la suma de los segmentos: si no suman
    # la exposición total, algo se perdió en el camino.
    bucket_cols = {
        "0": "bucket_0", "1-29": "bucket_1_29", "30-59": "bucket_30_59",
        "60-89": "bucket_60_89", "90+": "bucket_90_mas",
    }
    df_buckets = pd.DataFrame(
        [
            {
                "bucket": b,
                "etiqueta": DPD_LABELS[b],
                "exposicion": float(df_segmentos[bucket_cols[b]].sum()),
            }
            for b in DPD_BUCKETS
        ]
    )

    transiciones = []
    for i, origen in enumerate(DPD_BUCKETS):
        for j, destino in enumerate(DPD_BUCKETS):
            transiciones.append(
                {
                    "bucket_origen": origen,
                    "bucket_destino": destino,
                    "probabilidad": snapshot["transitionMatrix"][i][j],
                }
            )
    df_transiciones = pd.DataFrame(transiciones)

    resumen = {
        "moneda": summary["currency"],
        "exposicion_total": summary["totalExposure"],
        "perdida_esperada_total": summary["totalExpectedLoss"],
        "pd_ponderada": summary["weightedPd"],
        "lgd_ponderada": summary["weightedLgd"],
        "morosidad": summary["delinquencyRate"],
        "npl": summary["nplRate"],
        "segmentos": summary["segments"],
        "semilla": snapshot["seed"],
        "generado_en": snapshot["generatedAt"],
    }
    return {
        "segmentos": df_segmentos,
        "mensual": df_mensual,
        "buckets": df_buckets,
        "transiciones": df_transiciones,
        "resumen": resumen,
    }


def _agregar_pivote(writer, hoja_origen, titulo_pivote, nombre_pivote,
                    filas, datos):
    """Agrega una tabla dinámica NATIVA, o la salta si no hay qué resumir.

    Las dinámicas se arman sobre las hojas que pandas ya escribió en
    el libro abierto (``writer.book`` / ``writer.sheets``): son
    definición + caché + registros dentro del .xlsx, así que Excel las
    filtra y recalcula al abrir, en vez de ser valores pegados. Si la
    tabla está vacía, ``add_pivot_table`` levanta ValueError porque no
    hay filas que agrupar; eso no es un error de la exportación, así
    que se salta ese pivote y el libro sale igual con el resto.
    """
    try:
        add_pivot_table(
            writer.book,
            source_sheet=writer.sheets[hoja_origen],
            pivot_sheet_title=titulo_pivote,
            pivot_name=nombre_pivote,
            row_fields=filas,
            data_fields=datos,
        )
    except ValueError:
        pass


def write_excel(tables, path):
    """El libro de Excel: una hoja por tabla más el resumen."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    resumen_df = pd.DataFrame(
        [{"metrica": k, "valor": v} for k, v in tables["resumen"].items()]
    )
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        resumen_df.to_excel(writer, sheet_name="Resumen", index=False)
        tables["segmentos"].to_excel(writer, sheet_name="Segmentos", index=False)
        tables["mensual"].to_excel(writer, sheet_name="Mensual", index=False)
        tables["buckets"].to_excel(writer, sheet_name="Buckets", index=False)
        tables["transiciones"].to_excel(writer, sheet_name="Transiciones", index=False)
        # Las dinámicas van ANTES de que se cierre el `with`: ahí es
        # cuando pandas guarda el libro, así que todo lo que se agregue
        # después ya no entraría. La de segmentos muestra dónde se
        # concentra la exposición y la pérdida esperada por negocio; la
        # mensual, cómo se mueven la exposición, la pérdida esperada y
        # la morosidad mes a mes (la morosidad se promedia, no se suma:
        # sumar porcentajes no significa nada).
        if not tables["segmentos"].empty:
            _agregar_pivote(
                writer, "Segmentos", "Dinámica por segmento",
                "PivotSegmento",
                filas=["segmento"],
                datos=[("exposicion", "Exposición", "sum"),
                       ("perdida_esperada", "Pérdida esperada", "sum"),
                       ("cuentas", "Cuentas", "sum")],
            )
        if not tables["mensual"].empty:
            _agregar_pivote(
                writer, "Mensual", "Dinámica por mes", "PivotMes",
                filas=["etiqueta"],
                datos=[("exposicion", "Exposición", "sum"),
                       ("perdida_esperada", "Pérdida esperada", "sum"),
                       ("morosidad", "Morosidad promedio", "average")],
            )
    return path


def write_sqlite(tables, path):
    """Las mismas tablas en SQLite, con SQL plano (sin SQLAlchemy)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    conn = sqlite3.connect(path)
    try:
        for name in ("segmentos", "mensual", "buckets", "transiciones"):
            df = tables[name]
            cols = ", ".join(f'"{c}" TEXT' for c in df.columns)
            conn.execute(f'CREATE TABLE "{name}" ({cols})')
            conn.executemany(
                f'INSERT INTO "{name}" VALUES ({", ".join("?" * len(df.columns))})',
                [tuple(str(v) for v in row) for row in df.itertuples(index=False)],
            )
        conn.execute(
            "CREATE TABLE resumen (metrica TEXT PRIMARY KEY, valor TEXT)"
        )
        conn.executemany(
            "INSERT INTO resumen VALUES (?, ?)",
            [(k, str(v)) for k, v in tables["resumen"].items()],
        )
        conn.commit()
    finally:
        conn.close()
    return path


def write_tableau_csvs(tables, out_dir):
    """Los dos CSV que Tableau puede importar directo."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    seg_path = out_dir / "tableau_segmentos.csv"
    men_path = out_dir / "tableau_mensual.csv"
    tables["segmentos"].to_csv(seg_path, index=False)
    tables["mensual"].to_csv(men_path, index=False)
    return [seg_path, men_path]


def export(base_url, out_dir):
    """Hace todo: pide, construye y escribe. Devuelve lo que se escribió."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    snapshot = fetch_json(base_url, "/api/portfolio")
    summary = fetch_json(base_url, "/api/summary")
    tables = build_tables(snapshot, summary)
    written = {
        "excel": str(write_excel(tables, out_dir / "portfolio.xlsx")),
        "sqlite": str(write_sqlite(tables, out_dir / "portfolio.sqlite")),
        "tableau_csvs": [str(p) for p in write_tableau_csvs(tables, out_dir)],
        "resumen": tables["resumen"],
    }
    return written


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Exporta el portafolio del dashboard a Excel, SQLite y CSV."
    )
    parser.add_argument(
        "--api", default="http://localhost:4000",
        help="URL base de la API (por defecto: http://localhost:4000)",
    )
    parser.add_argument(
        "--out-dir", default="exports",
        help="directorio de salidas (por defecto: exports/)",
    )
    args = parser.parse_args(argv)
    try:
        written = export(args.api, args.out_dir)
    except ConnectionError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    resumen = written["resumen"]
    print(f"Segmentos:          {resumen['segmentos']}")
    print(f"Exposición total:   ${resumen['exposicion_total']:,.2f} MXN")
    print(f"Pérdida esperada:   ${resumen['perdida_esperada_total']:,.2f} MXN")
    print(f"PD ponderada:       {resumen['pd_ponderada']:.4f}")
    print(f"Excel:              {written['excel']}")
    print(f"SQLite:             {written['sqlite']}")
    for path in written["tableau_csvs"]:
        print(f"Tableau CSV:        {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
