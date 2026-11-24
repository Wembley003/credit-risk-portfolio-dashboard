#!/usr/bin/env bash
# export_portfolio.sh — exporta el portafolio del dashboard a Excel,
# SQLite y CSV para Tableau, con log y códigos de salida.
#
# La API tiene que estar corriendo (npm run dev -w credit-risk-api).
# El script lo verifica antes de intentar nada: si la API no responde,
# lo dice y sale con código 1.
#
# Uso:
#   ./scripts/export_portfolio.sh
#   ./scripts/export_portfolio.sh --api http://localhost:4000 --out-dir exports
#
# Códigos de salida: 0 = bien, 1 = la API no responde o falló la
# exportación, 2 = argumentos mal.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

API="http://localhost:4000"
OUT_DIR="exports"

usage() { sed -n '2,11p' "$0"; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --api) API="$2"; shift 2 ;;
        --out-dir) OUT_DIR="$2"; shift 2 ;;
        --help|-h) usage; exit 0 ;;
        *) echo "Argumento desconocido: $1" >&2; usage >&2; exit 2 ;;
    esac
done

# --- Qué Python usar: el venv compartido de quant-projects si existe,
# si no el python3 del sistema (que ya trae pandas y openpyxl).
pick_python() {
    if [[ -x "$PROJECT_DIR/../quant-projects/.venv/bin/python" ]]; then
        echo "$PROJECT_DIR/../quant-projects/.venv/bin/python"
    else
        echo "python3"
    fi
}
PYTHON="$(pick_python)"

mkdir -p logs "$OUT_DIR"
LOG_FILE="logs/export-$(date +%Y%m%d-%H%M%S).log"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG_FILE"; }

log "Exportando portafolio (API=$API, salida=$OUT_DIR)"

# --- Preflight: salud de la API antes de pedir el snapshot.
if command -v curl >/dev/null 2>&1; then
    if ! curl -fsS --max-time 5 "$API/health" -o /dev/null 2>>"$LOG_FILE"; then
        log "ERROR: la API no responde en $API/health. Arráncala con: npm run dev -w credit-risk-api"
        exit 1
    fi
else
    if ! "$PYTHON" -c "import urllib.request; urllib.request.urlopen('$API/health', timeout=5)" 2>>"$LOG_FILE"; then
        log "ERROR: la API no responde en $API/health. Arráncala con: npm run dev -w credit-risk-api"
        exit 1
    fi
fi

set +e
"$PYTHON" scripts/export_portfolio.py --api "$API" --out-dir "$OUT_DIR" 2>&1 | tee -a "$LOG_FILE"
STATUS=${PIPESTATUS[0]}
set -e

if [[ "$STATUS" -eq 0 ]]; then
    log "Exportación terminada OK. Salidas en $OUT_DIR. Log en $LOG_FILE."
else
    log "Exportación terminó con error (código $STATUS). Revisa el log: $LOG_FILE."
fi
exit "$STATUS"
