# Access (.accdb) del dashboard de riesgo de crédito

`credit-risk-dashboard.accdb` es una base **real** de Microsoft Access
(formato ACE14, Access 2010 en adelante) con las mismas 5 tablas del
portafolio exportado en SQLite: `segmentos`, `mensual`, `buckets`,
`transiciones` y `resumen`, con sus filas. Se abre en Access tal cual,
sin importar nada a mano: doble clic y las tablas ya están ahí.

## Cómo se regenera

En Linux no hay Access, así que el `.accdb` se construye en dos pasos
con Java (Jackcess escribe el formato ACE14 sin necesitar Windows):

```bash
# 1. Exporta el portafolio (la API tiene que estar corriendo)
./scripts/export_portfolio.sh   # escribe exports/portfolio.sqlite

# 2. Construye el .accdb (vuelca a CSV + schema, compila y verifica)
./access/build_access.sh exports/portfolio.sqlite credit-risk-dashboard.accdb
```

El script hace todo solo: vuelca las tablas a `access/csv/*.csv` con
`dump_access.py`, descarga los jars de Jackcess a `access/lib/` la
primera vez, compila `AccessBuilder.java` y verifica con `mdbtools`
que cada tabla del `.accdb` tenga las mismas filas que su CSV. Necesita
Python 3, JDK 17, `curl` y conexión la primera vez (para los jars).

## Cómo se abre en Access

Copia el `.accdb` a Windows y ábrelo con Microsoft Access. Las tablas
están listas para consultar. El DDL de referencia está en
`sql/schema_access.sql`.

## Nota honesta: todo es TEXT, y el `.accdb` es binario

La SQLite del dashboard guarda **todas** las columnas como TEXT
(`write_sqlite` convierte cada valor con `str()`), así que el `.accdb`
también las guarda como texto: no se finge que haya números donde en
origen son texto. Si algún día el exportador guarda tipos reales, el
`.accdb` y `sql/schema_access.sql` deben cambiar con él.

Además, el `.accdb` es binario y el push por lotes de GitHub solo lleva
archivos de texto, así que **no** se puede subir por esa vía: súbelo
por web desde el celular (Add file > Upload files en github.com), igual
que los PNG. Lo que sí viaja en texto —y es el pack de importación si
alguien quiere reconstruir la base a mano— son `access/csv/*.csv` más
`access/schema.txt` y `access/schema.json`: con esos tres, Access
importa cada tabla sin adivinar nada.

`access/lib/` (los jars descargados) y `access/build/` (los `.class`
compilados) no van a Git: se regeneran solos al correr el script.
