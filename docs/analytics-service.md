# analytics-service — Thiết kế & Triển khai End-to-End

Tài liệu này mô tả toàn bộ thiết kế, cấu trúc, API, Kafka consumer, Helm/K8s, và lộ trình implement cho `analytics-service`.

**Tài liệu liên quan:**
- [features.md](./features.md) — trạng thái MVP
- [service-urls.md](./service-urls.md) — URL gateway, local ports
- [api-routes.md](./api-routes.md) — chỉ mục route
- [dlq-service.md](./dlq-service.md) — DLQ ops service
- [.claude/docs/service-contracts.md](../.claude/docs/service-contracts.md) — auth headers, Service JWT
- [.claude/docs/service-architecture.md](../.claude/docs/service-architecture.md) — folder layout pattern

---

## 0. Trạng thái hiện tại

`analytics-service` đã có scaffold NestJS, Mongo read model, HTTP routes, Swagger,
health/metrics, Docker Compose, Helm values, gateway route, và auth guard với
permission `analytics.read`.

Live Kafka read model đã align với event bus canonical: user/workspace/task
outbox events đi qua Debezium CDC, analytics consume các topic cụ thể và dedupe
bằng collection `processed_analytics_events` trước khi cộng counter.

## 1. Mục đích

`analytics-service` là **backend read-model service** cung cấp dữ liệu thống kê tổng hợp cho admin dashboard. Thay vì FE tự gọi nhiều service rồi aggregate ở client, service này:

- Consume Kafka events từ các service khác để build read model pre-aggregated
- Expose HTTP API đơn giản, trả về số liệu sẵn dùng cho chart/card
- Không phục vụ end-user, chỉ phục vụ admin

**Phạm vi MVP:**

| Metric nhóm | Nguồn data | Phương pháp |
|-------------|------------|-------------|
| Users (total, active, banned, activeLast30d) | user events | Kafka consumer + snapshot |
| Workspaces (total, avgMembers, perDay) | workspace events | Kafka consumer + snapshot |
| Projects (total) | workspace events | Kafka consumer |
| Tasks (total, byStatus) | task events | Kafka consumer |
| Activity (events/day timeseries) | mọi domain events | Kafka consumer aggregate |

---

## 2. Kiến trúc

```
Kafka topics
  collabspace.user.registered
  collabspace.workspace.workspace_created
  collabspace.workspace.project_created
  collabspace.workspace.member_joined / member_left
  collabspace.task.task_created
  collabspace.task.task_status_changed
  collabspace.task.task_deleted
         │
         ▼
analytics-service (Kafka consumer group: analytics-service)
  → aggregate & upsert vào MongoDB collabspace_analytics
         │
         ▼
MongoDB collections:
  platform_snapshot    (1 doc, upsert theo interval)
  timeseries_daily     (1 doc/ngày/metric)
  processed_analytics_events (dedupe theo eventId)
         │
         ▼
HTTP API /api/v1/analytics/*
  → FE Admin Dashboard
```

**Không** có gRPC outbound. **Không** publish events mới. Chỉ consume + persist + serve.

---

## 3. Folder Layout

Theo pattern `task-service` / `notification-service` (CQRS + Mongo):

```
services/analytics-service/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   └── analytics.config.ts        # ConfigService schema
│   ├── health/
│   │   └── health.controller.ts       # /health/live, /health/ready
│   ├── metrics/
│   │   └── metrics.controller.ts      # /metrics (Prometheus)
│   │
│   ├── analytics/
│   │   ├── analytics.module.ts
│   │   ├── controllers/
│   │   │   └── analytics.controller.ts
│   │   ├── dto/
│   │   │   ├── platform-overview.dto.ts
│   │   │   └── timeseries-query.dto.ts
│   │   ├── services/
│   │   │   └── analytics.service.ts   # query read model
│   │   └── repositories/
│   │       └── analytics.repository.ts
│   │
│   ├── consumers/
│   │   ├── consumers.module.ts
│   │   ├── user-events.consumer.ts
│   │   ├── workspace-events.consumer.ts
│   │   └── task-events.consumer.ts
│   │
│   └── domain/
│       ├── platform-snapshot.schema.ts   # Mongoose schema
│       ├── timeseries-daily.schema.ts
│       └── processed-analytics-event.schema.ts
│
├── test/
├── CLAUDE.md
├── package.json
└── tsconfig.json
```

---

## 4. MongoDB Schemas

### `platform_snapshots` collection

```typescript
// 1 document duy nhất, upsert khi có event mới
{
  _id: "global",
  users: {
    total: number,
    active: number,        // isActive === true
    banned: number,
    withoutWorkspace: number,
    activeLast30d: number  // lastLoginAt > now-30d
  },
  workspaces: {
    total: number,
    totalMembers: number,
    avgMembersPerWorkspace: number
  },
  projects: {
    total: number
  },
  tasks: {
    total: number,
    byStatus: { TODO: number, DOING: number, DONE: number }
  },
  updatedAt: Date
}
```

### `timeseries_daily` collection

```typescript
// 1 doc/ngày/metric
{
  _id: ObjectId,
  date: "2026-06-20",     // YYYY-MM-DD, index unique compound (date, metric)
  metric: "users_registered" | "workspaces_created" | "tasks_created" | "tasks_completed",
  value: number,
  updatedAt: Date
}
```

Index: `{ date: 1, metric: 1 }` unique.

### `processed_analytics_events` collection

```typescript
{
  _id: "eventId-or-derived-id",
  eventType: "task_created",
  topic: "collabspace.task.task_created",
  processedAt: Date
}
```

`_id` unique giúp Kafka duplicate delivery không cộng counter nhiều lần. Nếu handler
thất bại sau khi claim event, repository xóa claim để retry có thể xử lý lại.

---

## 5. Kafka Consumers

Consumer group: `analytics-service`

### Topics consumed

| Topic | Events xử lý |
|-------|-------------|
| `collabspace.user.registered` | `user_registered` |
| `collabspace.workspace.workspace_created` | `workspace_created` |
| `collabspace.workspace.project_created` | `project_created` |
| `collabspace.workspace.member_joined` | `member_joined` |
| `collabspace.workspace.member_left` | `member_left` |
| `collabspace.task.task_created` | `task_created` |
| `collabspace.task.task_status_changed` | `task_status_changed` |
| `collabspace.task.task_deleted` | `task_deleted` |

### Consumer pattern (giống notification-service)

```typescript
@Injectable()
export class TaskEventsConsumer implements OnModuleInit {
  constructor(private readonly kafka: KafkaService, private readonly repo: AnalyticsRepository) {}

  async onModuleInit() {
    await this.kafka.subscribe('collabspace.task.task_created', async (message) => {
      const event = JSON.parse(message.value.toString());
      await this.handleTaskEvent(event);
    });
  }

  private async handleTaskEvent(event: any) {
    switch (event.type) {
      case 'task_created':
        await this.repo.incrementSnapshot('tasks.total', 1);
        await this.repo.incrementSnapshot(`tasks.byStatus.${event.payload.status}`, 1);
        await this.repo.incrementTimeseries(today(), 'tasks_created', 1);
        break;
      case 'task_status_changed':
        await this.repo.decrementSnapshot(`tasks.byStatus.${event.payload.previousStatus}`, 1);
        await this.repo.incrementSnapshot(`tasks.byStatus.${event.payload.newStatus}`, 1);
        if (event.payload.newStatus === 'DONE') {
          await this.repo.incrementTimeseries(today(), 'tasks_completed', 1);
        }
        break;
      case 'task_deleted':
        await this.repo.decrementSnapshot('tasks.total', 1);
        await this.repo.decrementSnapshot(`tasks.byStatus.${event.payload.status}`, 1);
        break;
    }
  }
}
```

### Idempotency

Mỗi event mới cho analytics có `eventId`; `user.registered` có thể dùng fallback
ổn định `user_registered:{userId}` vì event đăng ký chỉ tính một lần cho mỗi user.
Repository gọi `processEventOnce(eventId, eventType, topic, handler)` trước khi
`$inc`, lưu claim vào `processed_analytics_events`. Duplicate event → no-op.

---

## 6. HTTP API

Base path: `/api/v1/analytics`

Tất cả routes yêu cầu Bearer JWT và quyền `analytics.read` (platform `admin` có
permission này qua auth migration/seed).

### `GET /api/v1/analytics/overview`

Trả toàn bộ snapshot cho admin overview card.

**Response:**
```json
{
  "users": {
    "total": 120,
    "active": 110,
    "banned": 10,
    "withoutWorkspace": 5,
    "activeLast30d": 87
  },
  "workspaces": {
    "total": 34,
    "totalMembers": 198,
    "avgMembersPerWorkspace": 5.8
  },
  "projects": {
    "total": 76
  },
  "tasks": {
    "total": 412,
    "byStatus": { "TODO": 180, "DOING": 95, "DONE": 137 }
  },
  "updatedAt": "2026-06-20T10:30:00.000Z"
}
```

### `GET /api/v1/analytics/users`

Chi tiết user metrics. Response tương tự `overview.users` nhưng có thể mở rộng thêm breakdown sau.

### `GET /api/v1/analytics/workspaces`

Chi tiết workspace metrics.

### `GET /api/v1/analytics/tasks`

Chi tiết task metrics.

### `GET /api/v1/analytics/activity`

Timeseries data cho biểu đồ đường/cột.

**Query params:**
- `metric`: `users_registered` | `workspaces_created` | `tasks_created` | `tasks_completed` (default: `tasks_created`)
- `from`: ISO date string (default: 30 ngày trước)
- `to`: ISO date string (default: hôm nay)
- `interval`: `day` (MVP chỉ cần `day`)

**Response:**
```json
{
  "metric": "tasks_created",
  "interval": "day",
  "from": "2026-05-21",
  "to": "2026-06-20",
  "data": [
    { "date": "2026-05-21", "value": 3 },
    { "date": "2026-05-22", "value": 7 },
    ...
  ]
}
```

---

## 7. Permission & Auth

Dùng cùng pattern `PlatformAdminGuard` trong shared Nest auth package:
- Bearer JWT được verify qua auth gRPC
- Guard yêu cầu permission `analytics.read`
- Platform role `admin` nhận permission này qua auth migration/seed

Permission mới cần seed vào `auth-service`:
- `analytics.read` — xem số liệu thống kê

Không cần route internal. Không có S2S call đi ra.

---

## 8. Environment Variables

```env
# App
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# MongoDB
MONGO_URI=mongodb://admin:password@mongo:27017/collabspace_analytics?authSource=admin&replicaSet=rs0

# Kafka
KAFKA_BROKERS=kafka:9092
KAFKA_CLIENT_ID=analytics-service
KAFKA_GROUP_ID=analytics-service
KAFKA_CONSUMERS_ENABLED=true
KAFKA_TOPIC_USER_REGISTERED=collabspace.user.registered
KAFKA_TOPIC_WORKSPACE_CREATED=collabspace.workspace.workspace_created
KAFKA_TOPIC_WORKSPACE_PROJECT_CREATED=collabspace.workspace.project_created
KAFKA_TOPIC_WORKSPACE_MEMBER_JOINED=collabspace.workspace.member_joined
KAFKA_TOPIC_WORKSPACE_MEMBER_LEFT=collabspace.workspace.member_left
KAFKA_TOPIC_TASK_CREATED=collabspace.task.task_created
KAFKA_TOPIC_TASK_STATUS_CHANGED=collabspace.task.task_status_changed
KAFKA_TOPIC_TASK_DELETED=collabspace.task.task_deleted

# Auth
AUTH_SERVICE_GRPC_URL=auth-service:50051
AUTH_SERVICE_GRPC_TIMEOUT_MS=3000

# Metrics
METRICS_AUTH_TOKEN=<secret>
```

---

## 9. Helm / K8s

### values.yaml — thêm vào block `apps:`

```yaml
  analytics-service:
    enabled: true
    replicas: 1
    image:
      repository: collabspace/analytics-service
      tag: latest
    httpPort: 3000
    metricsPath: /api/v1/analytics/metrics
    health:
      readyPath: /api/v1/analytics/health/ready
      livePath: /api/v1/analytics/health/live
      preStopSleep: 5
      terminationGracePeriodSeconds: 20
    resources:
      requests:
        memory: 128Mi
        cpu: 100m
      limits:
        memory: 256Mi
        cpu: 250m
    extraEnv:
      KAFKA_CONSUMERS_ENABLED: "true"
      KAFKA_BROKERS: "kafka:9092"
      KAFKA_CLIENT_ID: "analytics-service"
      KAFKA_GROUP_ID: "analytics-service"
      KAFKA_TOPIC_USER_REGISTERED: "collabspace.user.registered"
      KAFKA_TOPIC_WORKSPACE_CREATED: "collabspace.workspace.workspace_created"
      KAFKA_TOPIC_WORKSPACE_PROJECT_CREATED: "collabspace.workspace.project_created"
      KAFKA_TOPIC_WORKSPACE_MEMBER_JOINED: "collabspace.workspace.member_joined"
      KAFKA_TOPIC_WORKSPACE_MEMBER_LEFT: "collabspace.workspace.member_left"
      KAFKA_TOPIC_TASK_CREATED: "collabspace.task.task_created"
      KAFKA_TOPIC_TASK_STATUS_CHANGED: "collabspace.task.task_status_changed"
      KAFKA_TOPIC_TASK_DELETED: "collabspace.task.task_deleted"
      MONGO_DB_NAME: "collabspace_analytics"
```

### Traefik route (gateway dynamic config)

```yaml
# Thêm vào api-gateway/dynamic/routes.yml
- match: PathPrefix(`/api/v1/analytics`)
  kind: Rule
  services:
    - name: analytics-service
      port: 3000
  middlewares:
    - name: strip-identity-headers
    - name: forward-auth
```

### Swagger route

```yaml
- match: PathPrefix(`/swagger/analytics`)
  kind: Rule
  services:
    - name: analytics-service
      port: 3000
  middlewares:
    - name: strip-prefix-swagger-analytics
```

### K8s Service (thêm vào services.yaml)

```yaml
- name: analytics-service
  port: 3000
  targetPort: 3000
```

---

## 10. Docker image

Repo hiện dùng Dockerfile chung `infrastructure/docker/Dockerfile.service` với
build arg `SERVICE_NAME=analytics-service` cho Docker Compose và CI image build.
Không cần Dockerfile riêng dưới `services/analytics-service/` trừ khi service có
runtime khác pattern chung.

Pattern image tương đương:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER app
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

---

## 11. Seed / Bootstrap

`analytics-service` không có seed data vì read model được build từ Kafka events. Tuy nhiên cần **bootstrap snapshot** khi deploy lần đầu vào môi trường đã có data:

**Option A — One-time script:** gọi internal API các service để lấy counts hiện tại rồi upsert `platform_snapshot`. Chạy 1 lần sau deploy.

**Option B — Scheduled aggregation fallback:** nếu snapshot quá cũ (> 24h), service tự gọi các service khác để recalculate. Phức tạp hơn, dùng cho Phase 2.

MVP: dùng Option A, viết script `scripts/seed-analytics-snapshot.sh`.

---

## 12. Observability

### Prometheus metrics

```
analytics_snapshot_updated_total           # số lần upsert snapshot
analytics_consumer_events_total{topic,type} # events processed per type
analytics_consumer_errors_total{topic}      # consumer errors
analytics_api_requests_total{route,status}  # HTTP requests
```

### Grafana

Thêm vào dashboard **CollabSpace Service Health** (UID `collabspace-service-health`):
- Consumer lag cho group `analytics-service`
- `analytics_consumer_events_total` rate

### Alerts (Prometheus rules)

```yaml
- alert: AnalyticsSnapshotStale
  expr: time() - analytics_snapshot_last_updated_timestamp > 3600
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "analytics-service snapshot chưa được update > 1 giờ"
```

---

## 13. Lộ Trình Implement (4 PR)

### PR 1 — Scaffold

- `services/analytics-service/` NestJS app, `package.json`, `tsconfig.json`
- Health endpoints `/health/live`, `/health/ready`
- Config module (Mongo URI, Kafka, JWT)
- Kết nối Mongo `collabspace_analytics`, tạo indexes
- Docker Compose entry (local port `3005`)
- Helm values entry (disabled ban đầu)

### PR 2 — Kafka consumers + read model

- `platform_snapshot` schema + repository (upsert với `$inc`)
- `timeseries_daily` schema + repository
- Consumer `user-events`, `workspace-events`, `task-events`
- Unit test consumer handlers

### PR 3 — HTTP API

- `GET /analytics/overview`
- `GET /analytics/activity?metric=...&from=...&to=...`
- `GET /analytics/users`, `/analytics/workspaces`, `/analytics/tasks`
- Swagger decorators, DTO validation
- `PlatformAdminGuard` / permission check
- Integration test với Mongo in-memory

### PR 4 — Infra + FE migration

- Helm values `enabled: true`, Traefik routes, Swagger route
- `service-urls.md` và `api-routes.md` update
- FE `AdminOverviewPage` đổi sang gọi `GET /analytics/overview`
- FE `AdminOverviewCharts` đổi sang gọi `GET /analytics/activity`
- Bootstrap script `scripts/seed-analytics-snapshot.sh`
- Prometheus metrics + Grafana panel

---

## 14. Service URL Summary

| Môi trường | Base URL |
|------------|----------|
| Production | `https://collabspace.ngocanh2005it.site/api/v1/analytics` |
| Local Docker | `http://localhost:3005/api/v1/analytics` |
| Swagger (prod) | `https://collabspace.ngocanh2005it.site/swagger/analytics` |
| Swagger (local) | `http://localhost:3005/swagger` |
| Health ready | `/api/v1/analytics/health/ready` |
| Health live | `/api/v1/analytics/health/live` |
| Metrics | `/api/v1/analytics/metrics` (Bearer `METRICS_AUTH_TOKEN`) |
