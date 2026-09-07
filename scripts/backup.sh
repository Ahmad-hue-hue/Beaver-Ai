#!/usr/bin/env bash
#
# Beaver — Postgres backup script (single-host production).
#
# Runs `pg_dump` against the Postgres container and keeps a rotating set of
# timestamped dumps under BACKUP_DIR. Compose a host cron entry like:
#
#   0 2 * * *  /opt/beaver/scripts/backup.sh >> /var/log/beaver-backup.log 2>&1
#
# Overridable env:
#   BACKUP_DIR     backup output dir (default: ./backups, relative to repo root)
#   RETENTION      number of backups to keep (default: 14)
#   POSTGRES_USER  (default: beaver)
#   POSTGRES_DB    (default: beaver)
#   POSTGRES_PORT  host port where Postgres is published (default: 5544, see .env)
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION="${RETENTION:-14}"
POSTGRES_USER="${POSTGRES_USER:-beaver}"
POSTGRES_DB="${POSTGRES_DB:-beaver}"
POSTGRES_PORT="${POSTGRES_PORT:-5544}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/beaver-$STAMP.sql.gz"

echo "[backup] dumping $POSTGRES_DB -> $FILE"
pg_dump -h localhost -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --no-owner --no-privileges | gzip -9 > "$FILE"

echo "[backup] done ($(du -h "$FILE" | cut -f1))."

# Rotate: keep the newest RETENTION backups, drop the rest.
ls -1t "$BACKUP_DIR"/beaver-*.sql.gz 2>/dev/null | tail -n +$((RETENTION + 1)) |
  while read -r old; do
    rm -f "$old"
    echo "[backup] pruned $old"
  done