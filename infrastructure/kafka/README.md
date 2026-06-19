# Kafka + Debezium Connect (local dev)

Nền tảng **Phase 0** của lộ trình migrate RabbitMQ → Kafka + CDC + Debezium.

**Lộ trình đầy đủ:** [docs/kafka-debezium-migration-roadmap.md](../../docs/kafka-debezium-migration-roadmap.md)

## Thành phần

| Service | Image | Port (host) | Mục đích |
|---------|-------|-------------|----------|
| `kafka` | `apache/kafka:3.8.0` (KRaft) | `9092`, `29092` | Broker (in-docker: `kafka:9092`, host: `localhost:29092`) |
| `debezium-connect` | `debezium/connect:2.7` | `8083` | Kafka Connect REST — đăng ký connector Phase 1+ |
| `kafka-ui` | `provectuslabs/kafka-ui` (profile `kafka-ui`) | `8088` | Xem topic / message (tùy chọn) |

RabbitMQ và app services **không đổi** ở Phase 0.

## Khởi động

Từ `infrastructure/docker` (cùng project name với stack chính — mặc định `COMPOSE_PROJECT_NAME=collabspace`):

```bash
# Kafka + Debezium only (nhẹ)
docker compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.kafka.yml up -d kafka debezium-connect

# Kèm Kafka UI
docker compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.kafka.yml --profile kafka-ui up -d
```

PowerShell:

```powershell
docker compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.kafka.yml up -d kafka debezium-connect
```

Stack dev đầy đủ (hot-reload + monitoring) **cộng** Kafka:

```bash
docker compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml -f docker-compose.kafka.yml up -d
```

## Smoke test (Phase 0 DoD)

```bash
# Linux / Git Bash
./scripts/kafka-phase0-smoke.sh
```

```powershell
# Windows
.\scripts\kafka-phase0-smoke.ps1
```

Kiểm tra thủ công:

```bash
# Connect REST
curl -s http://localhost:8083/connectors

# Produce / consume (trong container kafka)
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic collabspace.test --partitions 1 --replication-factor 1
docker exec kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic collabspace.test <<< "phase0-ok"
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic collabspace.test --from-beginning --max-messages 1 --timeout-ms 10000
```

Kafka UI: http://localhost:8088 (khi bật profile `kafka-ui`).

## Biến môi trường (tham chiếu)

Ghi trong `infrastructure/docker/.env.example` — app services **chưa** đọc các biến này cho đến Phase 2+.

```env
KAFKA_BROKERS=kafka:9092
KAFKA_BROKERS_HOST=localhost:29092
DEBEZIUM_CONNECT_URL=http://debezium-connect:8083
DEBEZIUM_CONNECT_URL_HOST=http://localhost:8083
```

## Phase tiếp theo

| Phase | Việc làm |
|-------|----------|
| **1** | `wal_level=logical` Postgres + Debezium connector `workspace_outbox_events` |
| **0M** | Mongo replica set (bắt buộc trước Debezium Mongo) |

## Rollback

```bash
docker compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.kafka.yml down
# Xóa volume broker (nếu cần reset topic):
docker volume rm collabspace_kafka_data
```

App CollabSpace vẫn chạy bình thường chỉ với RabbitMQ.

## Troubleshooting

| Triệu chứng | Gợi ý |
|-------------|--------|
| `debezium-connect` unhealthy lâu | Đợi ~60s lần đầu (tạo internal topics); xem `docker logs debezium-connect` |
| Client host không kết nối `localhost:9092` | Dùng **`localhost:29092`** (`PLAINTEXT_HOST` listener) |
| Network not found | Chạy `docker-compose.db.yml` hoặc `docker-compose.yml` trước để tạo `collabspace-network` |
| Connect 8083 connection refused | `docker compose ps debezium-connect` — đợi `healthy` |
