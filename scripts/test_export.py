"""Pruebas del exportador del dashboard (sin API: con un snapshot falso).

La idea es la misma que en los otros proyectos: las transformaciones
se prueban con datos de juguete que uno puede verificar a mano. Si el
script dice que EL = EAD x PD x LGD, el test lo comprueba con números
que caben en la cabeza. La parte que sí necesita la API (el fetch) se
prueba aparte, contra un servidor que no existe, para verificar que el
error sea claro y no un traceback raro.
"""

import json
import sqlite3
import zipfile
from pathlib import Path

import pandas as pd
import pytest

from export_portfolio import build_tables, export, fetch_json, write_excel


# Las piezas que una tabla dinámica NATIVA deja dentro del zip: su
# definición, su caché (qué columnas hay) y sus registros (las filas).
# Si falta una, Excel abre el archivo y dice que está dañado, así que
# se comprueban las seis, dos por cada pivote.
PARTES_PIVOTE = [
    "xl/pivotTables/pivotTable1.xml",
    "xl/pivotTables/pivotTable2.xml",
    "xl/pivotCache/pivotCacheDefinition1.xml",
    "xl/pivotCache/pivotCacheDefinition2.xml",
    "xl/pivotCache/pivotCacheRecords1.xml",
    "xl/pivotCache/pivotCacheRecords2.xml",
]

HOJAS_BASE = ["Resumen", "Segmentos", "Mensual", "Buckets", "Transiciones"]


def _snapshot_falso():
    """Dos segmentos, dos meses y una matriz 5x5 chica pero completa."""
    return {
        "seed": 1,
        "generatedAt": "2026-11-23T00:00:00.000Z",
        "currency": "MXN",
        "months": ["2025-12", "2026-01"],
        "segments": [
            {
                "id": "tarjeta", "name": "Tarjeta de crédito",
                "accounts": 100, "exposure": 1_000_000,
                "pd": 0.06, "lgd": 0.70,
                "bucketExposure": {"0": 860_000, "1-29": 70_000, "30-59": 30_000,
                                   "60-89": 20_000, "90+": 20_000},
                "ifrs9": {"stage1": 0.88, "stage2": 0.09, "stage3": 0.03},
            },
            {
                "id": "consumo", "name": "Consumo personal",
                "accounts": 50, "exposure": 500_000,
                "pd": 0.04, "lgd": 0.50,
                "bucketExposure": {"0": 450_000, "1-29": 25_000, "30-59": 11_000,
                                   "60-89": 6_500, "90+": 7_500},
                "ifrs9": {"stage1": 0.91, "stage2": 0.07, "stage3": 0.02},
            },
        ],
        "transitionMatrix": [
            [0.9, 0.05, 0.02, 0.02, 0.01],
            [0.4, 0.4, 0.1, 0.05, 0.05],
            [0.2, 0.3, 0.3, 0.1, 0.1],
            [0.1, 0.2, 0.3, 0.2, 0.2],
            [0.05, 0.05, 0.1, 0.2, 0.6],
        ],
        "monthly": [
            {"month": "2025-12", "label": "Dic 2025", "exposure": 1_500_000,
             "expectedLoss": 67_000, "delinquencyRate": 0.05, "nplRate": 0.02},
            {"month": "2026-01", "label": "Ene 2026", "exposure": 1_520_000,
             "expectedLoss": 68_000, "delinquencyRate": 0.051, "nplRate": 0.021},
        ],
    }


def _summary_falso():
    return {
        "currency": "MXN",
        "totalExposure": 1_500_000,
        "totalExpectedLoss": 67_000,
        "weightedPd": 0.0533,
        "weightedLgd": 0.6333,
        "delinquencyRate": 0.05,
        "nplRate": 0.02,
        "segments": 2,
        "months": ["2025-12", "2026-01"],
    }


def test_build_tables_perdida_esperada_es_ead_por_pd_por_lgd():
    tables = build_tables(_snapshot_falso(), _summary_falso())
    seg = tables["segmentos"]
    tarjeta = seg.loc[seg["segmento_id"] == "tarjeta"].iloc[0]
    # 1,000,000 x 0.06 x 0.70 = 42,000. A mano, sin calculadora.
    assert tarjeta["perdida_esperada"] == pytest.approx(42_000.0)
    consumo = seg.loc[seg["segmento_id"] == "consumo"].iloc[0]
    assert consumo["perdida_esperada"] == pytest.approx(10_000.0)


def test_buckets_suman_la_exposicion_total():
    tables = build_tables(_snapshot_falso(), _summary_falso())
    assert tables["buckets"]["exposicion"].sum() == pytest.approx(1_500_000.0)
    bucket_90 = tables["buckets"].loc[tables["buckets"]["bucket"] == "90+"].iloc[0]
    assert bucket_90["exposicion"] == pytest.approx(27_500.0)


def test_matriz_de_transicion_25_celdas_y_filas_que_suman_1():
    tables = build_tables(_snapshot_falso(), _summary_falso())
    trans = tables["transiciones"]
    assert len(trans) == 25
    for _, group in trans.groupby("bucket_origen"):
        assert group["probabilidad"].sum() == pytest.approx(1.0)


def test_fetch_sin_api_da_error_claro():
    with pytest.raises(ConnectionError, match="no se pudo contactar la API"):
        fetch_json("http://localhost:9", "/api/portfolio", timeout=2)


def test_export_escribe_excel_sqlite_y_csv(tmp_path, monkeypatch):
    # Se intercepta el fetch para no necesitar la API de verdad.
    import export_portfolio
    snap = _snapshot_falso()
    summ = _summary_falso()

    def falso_fetch(base_url, path, timeout=10):
        return snap if path == "/api/portfolio" else summ

    monkeypatch.setattr(export_portfolio, "fetch_json", falso_fetch)
    out = tmp_path / "exports"
    written = export("http://localhost:4000", out)
    assert Path(written["excel"]).exists()
    assert Path(written["sqlite"]).exists()
    assert len(written["tableau_csvs"]) == 2
    conn = sqlite3.connect(written["sqlite"])
    assert conn.execute("SELECT COUNT(*) FROM segmentos").fetchone()[0] == 2
    assert conn.execute("SELECT COUNT(*) FROM mensual").fetchone()[0] == 2
    assert conn.execute("SELECT COUNT(*) FROM transiciones").fetchone()[0] == 25
    conn.close()
    from openpyxl import load_workbook
    wb = load_workbook(written["excel"])
    assert wb.sheetnames == HOJAS_BASE + [
        "Dinámica por segmento", "Dinámica por mes",
    ]

def test_write_excel_incluye_tablas_dinamicas_nativas(tmp_path):
    tables = build_tables(_snapshot_falso(), _summary_falso())
    xlsx = tmp_path / "portfolio.xlsx"
    write_excel(tables, xlsx)
    with zipfile.ZipFile(xlsx) as zf:
        nombres = zf.namelist()
    for parte in PARTES_PIVOTE:
        assert parte in nombres, f"falta {parte} en el .xlsx"
    from openpyxl import load_workbook
    wb = load_workbook(xlsx)
    assert "Dinámica por segmento" in wb.sheetnames
    assert "Dinámica por mes" in wb.sheetnames
    # openpyxl relee las definiciones: cada hoja de pivote trae la suya,
    # con su nombre y su caché, no una hoja con valores pegados.
    assert [p.name for p in wb["Dinámica por segmento"]._pivots] == [
        "PivotSegmento"
    ]
    assert [p.name for p in wb["Dinámica por mes"]._pivots] == ["PivotMes"]


def test_write_excel_con_tablas_vacias_salta_los_pivotes_sin_romper(tmp_path):
    # Sin segmentos ni meses no hay nada que agrupar: los pivotes se
    # saltan y el libro sale igual con las cinco hojas base.
    tables = build_tables(_snapshot_falso(), _summary_falso())
    tables["segmentos"] = tables["segmentos"].iloc[0:0]
    tables["mensual"] = tables["mensual"].iloc[0:0]
    xlsx = tmp_path / "vacio.xlsx"
    write_excel(tables, xlsx)
    from openpyxl import load_workbook
    wb = load_workbook(xlsx)
    assert wb.sheetnames == HOJAS_BASE
    with zipfile.ZipFile(xlsx) as zf:
        nombres = zf.namelist()
    for parte in PARTES_PIVOTE:
        assert parte not in nombres
