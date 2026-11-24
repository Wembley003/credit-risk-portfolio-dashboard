"""Pruebas de la estructura por capas del tablero.

Las tres capas del proyecto (Bronce/Plata/Oro NO aplica aquí: no hay
un ETL con staging crudo → limpio → agregado; el snapshot se genera
sintético en memoria y se sirve tal cual). El monorepo ya separa las
capas por paquete, así que la prueba verifica que esa separación se
respete en los imports:

    Cliente (presentación): apps/web (React) y apps/api (Express)
                            (lo que el usuario ve y toca)
    Reglas de negocio:      packages/core (las fórmulas: EL = PD x LGD x EAD,
                            PD/LGD ponderadas, morosidad, buckets,
                            matriz de transición)
    Consultas o análisis:   scripts/export_portfolio.py (del snapshot de
                            la API a SQLite, Excel y CSV para Tableau) y
                            sql/schema_access.sql
                            (las métricas y los agregados, preguntados
                            y exportados; la tecnología aquí es la API +
                            Python, no SQL directo en la web)

La regla es de dirección: el núcleo (reglas) no conoce el servidor ni
la web; la web y la API no tocan SQLite directo; el script de
exportación consume la API por HTTP, nunca importando su código.
"""

import re
from pathlib import Path

_PROJECT = Path(__file__).resolve().parent.parent
_WEB = _PROJECT / "apps" / "web" / "src"
_API = _PROJECT / "apps" / "api" / "src"
_CORE = _PROJECT / "packages" / "core" / "src"
_SCRIPTS = _PROJECT / "scripts"

_IMPORT_RE = re.compile(
    r"""(?:^|\n)\s*import\s+(?:[^'";\n]*?\s+from\s+)?['"]([^'"]+)['"]"""
    r"""|(?:^|\n)\s*export\s+[^'";\n]*?\s+from\s+['"]([^'"]+)['"]""",
    re.MULTILINE,
)


def _todos_imports_ts(directorio: Path) -> dict[str, set[str]]:
    """stem -> imports, para todos los .ts/.tsx de un directorio."""
    salida = {}
    for path in sorted(directorio.rglob("*.ts")) + sorted(directorio.rglob("*.tsx")):
        if ".test." in path.name:
            continue
        texto = path.read_text(encoding="utf-8")
        modulos = {g for grupo in _IMPORT_RE.findall(texto) for g in grupo if g}
        salida[str(path.relative_to(_PROJECT))] = modulos
    return salida


def test_las_tres_capas_existen():
    assert (_WEB / "App.tsx").exists()
    assert (_API / "index.ts").exists()
    assert (_CORE / "metrics.ts").exists()
    assert (_CORE / "generator.ts").exists()
    assert (_SCRIPTS / "export_portfolio.py").exists()


def test_reglas_no_conocen_al_cliente():
    # El núcleo no importa el servidor, la web ni SQLite: pura
    # matemática sobre el snapshot que le pasan.
    for archivo, importados in _todos_imports_ts(_CORE).items():
        assert not any("express" in i or "cors" in i for i in importados), archivo
        assert not any("react" in i for i in importados), archivo
        assert not any("sqlite3" in i for i in importados), archivo
        assert not any("apps/" in i for i in importados), archivo


def test_cliente_no_toca_sqlite_directo():
    # Ni la web ni la API abren la base: los agregados los calcula el
    # núcleo y la API solo los sirve.
    for archivo, importados in list(_todos_imports_ts(_WEB).items()) + list(
        _todos_imports_ts(_API).items()
    ):
        assert not any("sqlite3" in i for i in importados), archivo
        assert not any("openpyxl" in i for i in importados), archivo
    for archivo, importados in _todos_imports_ts(_WEB).items():
        assert not any("express" in i for i in importados), archivo
        assert not any("apps/api" in i for i in importados), archivo
    for archivo, importados in _todos_imports_ts(_API).items():
        assert not any("apps/web" in i for i in importados), archivo
        assert not any("scripts" in i for i in importados), archivo


def test_exportacion_consume_la_api_por_http():
    # El script de exportación (consultas) no importa código de la
    # API ni de la web: lee el snapshot por HTTP, como cualquier
    # cliente. La frontera entre capas es la red, no un import.
    texto = (_SCRIPTS / "export_portfolio.py").read_text(encoding="utf-8")
    assert "urllib" in texto
    assert "http" in texto.lower()
    assert "apps/api" not in texto
    assert "apps/web" not in texto
    assert "packages/core" not in texto
