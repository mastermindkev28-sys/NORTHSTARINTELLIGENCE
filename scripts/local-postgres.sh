#!/usr/bin/env bash
# Starts a local, disposable PostgreSQL 16 cluster for development and integration tests.
# Usage: scripts/local-postgres.sh [start|stop|status]
# Alternative: `docker compose up -d postgres` (see docker-compose.yml).
set -euo pipefail

PORT="${NORTHSTAR_PG_PORT:-54329}"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
if [[ -z "${PGBIN}" || ! -x "${PGBIN}/pg_ctl" ]]; then
  PGBIN="$(dirname "$(command -v pg_ctl)")"
fi
CMD="${1:-start}"

# Postgres refuses to run as root; delegate to the postgres system user when needed.
if [[ "$(id -u)" == "0" ]]; then
  DATA_DIR="${NORTHSTAR_PG_DATA:-/tmp/northstar-pgdata}"
  run() { runuser -u postgres -- "$@"; }
else
  DATA_DIR="${NORTHSTAR_PG_DATA:-$(pwd)/.pgdata}"
  run() { "$@"; }
fi

case "$CMD" in
  start)
    if [[ ! -f "${DATA_DIR}/PG_VERSION" ]]; then
      mkdir -p "${DATA_DIR}"
      [[ "$(id -u)" == "0" ]] && chown postgres:postgres "${DATA_DIR}"
      run "${PGBIN}/initdb" -D "${DATA_DIR}" -U postgres --auth=trust --encoding=UTF8 >/dev/null
    fi
    if ! run "${PGBIN}/pg_ctl" -D "${DATA_DIR}" status >/dev/null 2>&1; then
      run "${PGBIN}/pg_ctl" -D "${DATA_DIR}" -o "-p ${PORT} -k /tmp -c listen_addresses=localhost" -l "${DATA_DIR}/server.log" -w start >/dev/null
    fi
    psql -h localhost -p "${PORT}" -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='northstar'" | grep -q 1 || \
      psql -h localhost -p "${PORT}" -U postgres -qc "CREATE ROLE northstar LOGIN SUPERUSER PASSWORD 'northstar'"
    psql -h localhost -p "${PORT}" -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='northstar'" | grep -q 1 || \
      psql -h localhost -p "${PORT}" -U postgres -qc "CREATE DATABASE northstar OWNER northstar"
    echo "Postgres ready: postgres://northstar:northstar@localhost:${PORT}/northstar"
    ;;
  stop)
    run "${PGBIN}/pg_ctl" -D "${DATA_DIR}" -m fast stop
    ;;
  status)
    run "${PGBIN}/pg_ctl" -D "${DATA_DIR}" status
    ;;
  *)
    echo "usage: $0 [start|stop|status]" >&2
    exit 2
    ;;
esac
