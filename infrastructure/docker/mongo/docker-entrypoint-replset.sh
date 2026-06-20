#!/usr/bin/env bash
# Dev-only: single-node replica set (rs0) with internal keyFile for auth + replication.
set -euo pipefail

KEYFILE=/data/configdb/mongo-keyfile
if [ ! -f "$KEYFILE" ]; then
  openssl rand -base64 756 > "$KEYFILE"
  chmod 400 "$KEYFILE"
fi

exec docker-entrypoint.sh mongod --replSet rs0 --bind_ip_all --keyFile "$KEYFILE"
