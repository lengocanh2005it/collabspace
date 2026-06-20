# Kafka + Debezium Connect (local dev)

Nền tảng **Phase 0** của lộ trình migrate RabbitMQ → Kafka + CDC + Debezium.

**Lộ trình đầy đủ:** [docs/kafka-debezium-migration-roadmap.md](../../docs/kafka-debezium-migration-roadmap.md)

## Thành phần

| Service | Image | Port (host) | Mục đích |
|---------|-------|-------------|----------|
| `kafka` | `apache/kafka:3.8.0` (KRaft) | `9092`, `29092` | Broker (in-docker: `kafka:9092`, host: `localhost:29092`) |
| `debezium-connect` | `quay.io/debezium/connect:2.7.3.Final` | `8083` | Kafka Connect REST — đăng ký connector Phase 1+ |
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

## Phase 1 — CDC workspace outbox (quan sát)

**Mục tiêu:** INSERT `workspace_outbox_events` → Debezium → Kafka topic `collabspace.workspace.workspace_invited` (RMQ processor **vẫn chạy**).

### 1. Postgres `wal_level=logical`

`docker-compose.db.yml` đã set `wal_level=logical`. Nếu volume Postgres **cũ** (tạo trước Phase 1), recreate hoặc:

```powershell
docker compose -f docker-compose.yml -f docker-compose.db.yml up -d --force-recreate postgres
docker exec postgres psql -U postgres -c "SHOW wal_level;"
# phải thấy: logical
```

### 2. Migration workspace outbox

```powershell
cd services/workspace-service
pnpm run migrate
```

### 3. Đăng ký connector

```powershell
.\scripts\register-workspace-outbox-connector.ps1
```

Config: `infrastructure/kafka/connectors/workspace-outbox-connector.json`

### 4. Smoke test Phase 1

```powershell
.\scripts\kafka-phase1-smoke.ps1
```

Hoặc invite workspace qua API → xem topic trên Kafka UI.

Topics (sau Outbox Event Router):

| `event_type` | Kafka topic |
|--------------|-------------|
| `workspace.workspace_invited` | `collabspace.workspace.workspace_invited` |
| `workspace.workspace_deleted` | `collabspace.workspace.workspace_deleted` |

## Phase 2 — Kafka consumer pilot (notification-service)

Bật trong `services/notification-service/.env`:

```env
KAFKA_CONSUMERS_ENABLED=true
KAFKA_BROKERS=kafka:9092
KAFKA_TOPIC_WORKSPACE_INVITED=collabspace.workspace.workspace_invited
```

RabbitMQ listener **vẫn bật** — idempotency theo `eventId` tránh duplicate khi dual-run.

Restart notification-service sau khi đổi env. Invite workspace → kiểm tra log `via kafka` / `via rmq`.

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
| **2** | Kafka consumer pilot `workspace_invited` (dual-run RMQ) — **Done** |
| **3** | Cutover workspace events (chỉ Kafka) — **Done** (local E2E) |
| **4** | User outbox + CDC — **Done** (local E2E) |
| **5M** | Task Mongo outbox + Debezium — **Done** (local E2E script) |
| **6** | Gỡ RabbitMQ — **Next** |

## E2E verify (Phase 3 + 4 + 5M)

Full stack (built images + Kafka):

```powershell
.\scripts\docker-local-up.ps1 -Kafka
.\scripts\register-workspace-outbox-connector.ps1
.\scripts\register-user-outbox-connector.ps1
.\scripts\register-task-outbox-connector.ps1
.\scripts\kafka-phase3-e2e.ps1
.\scripts\kafka-phase4-e2e.ps1
.\scripts\kafka-phase5-e2e.ps1
```

Phase 3: register 2 user → invite → `WORKSPACE_INVITED` notification → delete workspace → task gone.  
Phase 4: register → `user_replicas` → PATCH profile → replica `displayName` updated.  
Phase 5M: @mention trên task chưa assign → `COMMENT_MENTIONED`; assign → `TASK_ASSIGNED`; comment follow-up (assignee) → `COMMENT_ADDED` (`task.comment_created` topic).

**Consumer groups:** code dùng `${KAFKA_GROUP_ID}-user-events`, `-workspace-events`, `-task-events` — không gộp một group.

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
| Task Kafka consumer skip message (invalid JSON) | MongoEventRouter có thể emit `payload` dạng JSON string — consumer parse 2 lần (`kafka-outbox-message.ts`) |
