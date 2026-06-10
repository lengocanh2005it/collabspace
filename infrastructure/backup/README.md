# Backup scripts

Helper scripts for CollabSpace data stores. See `docs/backup-policy.md` for RPO/RTO and operational policy.

## Prerequisites

- Docker Compose stack with databases up (`infrastructure/docker/docker-compose.db.yml`).
- Default container names from compose: `postgres`, `mongodb`.

## Usage

From repository root (Git Bash or WSL on Windows):

```sh
chmod +x infrastructure/backup/scripts/*.sh
./infrastructure/backup/scripts/backup-postgres.sh
./infrastructure/backup/scripts/backup-mongo.sh
```

Output: `infrastructure/backup/artifacts/<timestamp>/`

## Restore (manual smoke test)

Postgres (single DB):

```sh
gunzip -c artifacts/<ts>/collabspace_auth.sql.gz | docker exec -i postgres psql -U postgres -d collabspace_auth
```

Mongo:

```sh
docker exec -i mongodb mongorestore --archive --gzip < artifacts/<ts>/mongo.archive.gz
```

Adjust container names and credentials to match your environment.
