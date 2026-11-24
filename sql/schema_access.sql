-- Esquema para Microsoft Access (.accdb): segmentos, mensual,
-- buckets, transiciones y resumen (las 5 tablas que escribe
-- scripts/export_portfolio.py en portfolio.sqlite).
--
-- NOTA HONESTA: write_sqlite guarda TODAS las columnas como TEXT
-- (convierte cada valor con str() antes de insertarlo), así que este
-- DDL hace exactamente lo mismo: todo TEXT. No se finge que haya
-- números en Access cuando en SQLite son texto. Si algún día
-- write_sqlite guarda tipos reales, este DDL debe cambiar con él.
-- Las longitudes TEXT(255) son el máximo de un campo de texto corto
-- en Access; los valores reales son mucho más cortos.
--
-- Esto es SOLO el esquema (DDL), no una integración con Access. La
-- base .accdb real está en access/credit-risk-dashboard.accdb,
-- construida con access/build_access.sh. Para usar este DDL a mano:
-- en Access, Crear > Diseño de consulta > vista SQL, pegar este
-- script y ejecutarlo.

CREATE TABLE segmentos (
    segmento         TEXT(255),
    segmento_id      TEXT(255),
    cuentas          TEXT(255),
    exposicion       TEXT(255),
    pd               TEXT(255),
    lgd              TEXT(255),
    perdida_esperada TEXT(255),
    bucket_0         TEXT(255),
    bucket_1_29      TEXT(255),
    bucket_30_59     TEXT(255),
    bucket_60_89     TEXT(255),
    bucket_90_mas    TEXT(255),
    ifrs9_etapa1     TEXT(255),
    ifrs9_etapa2     TEXT(255),
    ifrs9_etapa3     TEXT(255)
);

CREATE TABLE mensual (
    mes              TEXT(255),
    etiqueta         TEXT(255),
    exposicion       TEXT(255),
    perdida_esperada TEXT(255),
    morosidad        TEXT(255),
    npl              TEXT(255)
);

CREATE TABLE buckets (
    bucket     TEXT(255),
    etiqueta   TEXT(255),
    exposicion TEXT(255)
);

CREATE TABLE transiciones (
    bucket_origen  TEXT(255),
    bucket_destino TEXT(255),
    probabilidad   TEXT(255)
);

CREATE TABLE resumen (
    metrica TEXT(255),
    valor   TEXT(255)
);
