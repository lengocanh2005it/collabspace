# MongoDB (local dev) — replica set `rs0`

Phase **0M** của [Kafka + Debezium migration](../../docs/kafka-debezium-migration-roadmap.md): Mongo **bắt buộc replica set** cho:

- MongoDB multi-document transactions (`withTransaction`) — Phase 5M
- Debezium Mongo connector (change streams)

## Local Docker

`infrastructure/docker/docker-compose.db.yml`:

| Thành phần | Mô tả |
|------------|--------|
| `mongo` | Image `collabspace-mongo-rs:6` (`mongo/Dockerfile`), `--replSet rs0`, keyFile trong volume `/data/configdb` |
| `mongo-rs-init` | One-shot `rs.initiate({ _id: "rs0", members: [{ host: "mongo:27017" }] })` |

Connection string (task / notification):

```text
mongodb://admin:password@mongo:27017/<db>?authSource=admin&replicaSet=rs0
```

Host (ngoài Docker): `localhost:27017` với cùng query `replicaSet=rs0`.

## Khởi động / verify

```powershell
cd infrastructure/docker
docker compose -f docker-compose.db.yml up -d mongo mongo-rs-init

# Hoặc từ repo root
.\scripts\init-mongo-rs.ps1
.\scripts\mongo-phase0m-smoke.ps1   # Phase 0M DoD: rs0 + txn + task/notification ready
```

```bash
./scripts/init-mongo-rs.sh
./scripts/mongo-phase0m-smoke.sh
```

DoD (full — cần stack đang chạy):

```powershell
.\scripts\docker-local-up.ps1 -Kafka
.\scripts\mongo-phase0m-smoke.ps1
```

## Đổi từ standalone cũ

Nếu volume `mongodata` đã từng chạy **không** replica set, có thể cần recreate:

```bash
cd infrastructure/docker
docker compose -f docker-compose.db.yml down
docker volume rm collabspace_mongodata   # hoặc tên project_prefix_mongodata
docker compose -f docker-compose.db.yml up -d mongo mongo-rs-init
```

Sau đó chạy lại migrate/seed task + notification.

## Prod / K8s

`infrastructure/k8s/mongo-statefulset.yaml` hiện **chưa** bật replica set — cần ticket infra trước Phase 5M prod. Helm `collabspace.mongoUri` có thể thêm `replicaSet=` khi cluster RS sẵn sàng.
