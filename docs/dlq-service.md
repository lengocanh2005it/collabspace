# dlq-service — Thiết kế & Triển khai End-to-End

Tài liệu này mô tả toàn bộ thiết kế, state machine, API, scheduler, Helm/K8s, và lộ trình implement cho `dlq-service`.

**Tài liệu liên quan:**
- [features.md](./features.md) — trạng thái MVP
- [service-urls.md](./service-urls.md) — URL gateway, local ports
- [analytics-service.md](./analytics-service.md) — admin analytics service
- [.claude/docs/resilience.md](../.claude/docs/resilience.md) — resilience patterns
- [.claude/docs/service-contracts.md](../.claude/docs/service-contracts.md) — Kafka topics, Service JWT

---

## 1. Mục đích

`dlq-service` là **ops service** quản lý vòng đời Dead Letter Queue cho toàn hệ thống CollabSpace. Khi một Kafka consumer (task-service, notification-service, ...) xử lý event thất bại sau N lần retry in-process, nó publish message vào topic `collabspace.dlq.events`. `dlq-service` là source of truth cho toàn bộ DLQ lifecycle: ingest, inspect, replay, discard, audit.

**Nguyên tắc cốt lõi:**
- Message vào DLQ không được replay ngay. DLQ là trạng thái chờ điều tra, không phải queue retry tức thì. Replay ngay khi nguyên nhân lỗi vẫn còn sẽ tạo vòng lặp: consumer fail → DLQ → replay → consumer fail lại.
- Auto-retry chỉ áp dụng cho lỗi **transient** (`errorCategory = transient`). Lỗi logic/schema không auto-retry.
- `requires_manual_review` là trạng thái hệ thống tự set khi ingest lỗi logic/schema hoặc khi replay vượt policy. Admin không "mark manual review" trong scope mặc định; nếu cần escalate thủ công sau này mới thêm API riêng.
- `resolved` chỉ được set bởi admin action tường minh — "đã xử lý tay, không cần replay nữa".
- Không hard-delete record. Chỉ update status. Audit trail quan trọng hơn disk space.
- Atomic lock khi replay để tránh nhiều replica xử lý cùng record.

---

## 2. Chiến Lược Replay

```
Consumer fail
  → retry nội bộ 3 lần với backoff ngắn (in-process)
  → classify lỗi: transient | logic | schema | unknown
  → publish DLQ envelope (với errorCategory)
         ↓
dlq-service nhận, persist status=pending
         ↓
         ├─ errorCategory=transient → scheduler auto-retry theo backoff
         │     attempt 1: +5 phút
         │     attempt 2: +30 phút
         │     attempt 3: +2 giờ
         │     sau maxRetries → requires_manual_review
         │
         ├─ errorCategory=logic|schema → thẳng requires_manual_review, không auto-retry
         │
         └─ errorCategory=unknown → auto-retry 1 lần, nếu fail → requires_manual_review
                  ↓
         Admin inspect payload/errorMessage/stack
         → fix bug + deploy → POST /replay (manual)
         → hoặc POST /discard nếu message không còn hợp lệ
         → hoặc POST /resolve nếu đã xử lý tay không cần replay
```

**Lý do không replay ngay:**
- Lỗi logic/schema: replay vào consumer đang chạy code cũ sẽ fail tiếp, tạo DLQ record mới, gây noise vận hành.
- Lỗi transient: có thể tự hồi phục sau vài phút — backoff schedule xử lý điều này.
- Manual replay chỉ thực sự có ý nghĩa sau khi fix nguyên nhân gốc rễ.

---

## 3. DLQ Record Schema

Collection: `dlq_records` trong database `collabspace_dlq`

```typescript
{
  _id: ObjectId,

  // Origin
  sourceTopic: string,         // "collabspace.task.events"
  sourcePartition: number,
  sourceOffset: string,
  sourceKey: string | null,    // Kafka message key (preserve partition routing khi replay)
  consumerGroup: string,       // consumer group đã fail

  // Payload & Error
  payload: object,             // parsed JSON của Kafka message value
  errorMessage: string,        // lỗi cuối cùng gây ra DLQ
  errorCategory: ErrorCategory, // transient | logic | schema | unknown
  failedAt: Date,              // thời điểm consumer fail lần cuối

  // Lifecycle
  status: DlqStatus,
  retryCount: number,          // số lần đã thử replay (auto + manual)
  maxRetries: number,          // default: transient=3, unknown=1, logic/schema=0
  nextRetryAt: Date | null,    // null khi không còn auto-retry
  lastRetriedAt: Date | null,

  // Audit
  replayedBy: string | null,   // userId nếu admin replay thủ công, "scheduler" nếu auto
  retryHistory: Array<{
    at: Date,
    by: string,                // userId hoặc "scheduler"
    action: 'auto_retry' | 'manual_replay' | 'resolve' | 'discard',
    result: 'success' | 'failure',
    errorMessage?: string,
  }>,
  resolvedBy: string | null,
  discardedBy: string | null,
  resolutionNote: string | null,

  // Lock (tránh race condition giữa nhiều replica)
  lockedAt: Date | null,
  lockedBy: string | null,     // pod name đang replay

  createdAt: Date,
  updatedAt: Date
}
```

### ErrorCategory Enum

```typescript
type ErrorCategory =
  | 'transient'  // timeout, network, 503, DB temporary → auto-retry
  | 'logic'      // bug code, business rule violation → requires_manual_review ngay
  | 'schema'     // payload sai format, validation fail → requires_manual_review ngay
  | 'unknown'    // không classify được → auto-retry 1 lần
```

**maxRetries theo category:**

| errorCategory | maxRetries | Hành vi |
|---------------|------------|---------|
| `transient` | 3 | Backoff 5m → 30m → 2h, sau đó `requires_manual_review` |
| `unknown` | 1 | Retry 1 lần sau 5m, nếu fail → `requires_manual_review` |
| `logic` | 0 | Không auto-retry, thẳng `requires_manual_review` khi ingest |
| `schema` | 0 | Không auto-retry, thẳng `requires_manual_review` khi ingest |

### Status Enum

```typescript
type DlqStatus =
  | 'pending'                // chờ xử lý — auto-retry nếu nextRetryAt <= now
  | 'replaying'              // đang replay, đã lock bởi một pod
  | 'requires_manual_review' // vượt maxRetries hoặc lỗi non-transient — cần admin
  | 'resolved'               // admin đã xác nhận xử lý tay (terminal)
  | 'discarded'              // admin đã discard, không replay nữa (terminal)
```

> **Không có status `replayed`.** Khi replay Kafka produce thành công, record chuyển về `pending` với `retryCount++` và `nextRetryAt = null` (đã xong nhiệm vụ từ phía DLQ). Admin muốn biết kết quả cuối cùng thì dùng `resolved` hoặc `discarded`. Outcome của downstream consumer không thuộc trách nhiệm của DLQ record này — nếu downstream fail tiếp, nó tạo DLQ record mới.

### MongoDB Indexes

```javascript
{ status: 1, nextRetryAt: 1 }                              // scheduler query
{ status: 1, errorCategory: 1 }                            // filter
{ sourceTopic: 1, status: 1 }                              // filter theo topic
{ createdAt: -1 }                                          // list API sort
{ sourceTopic: 1, sourcePartition: 1, sourceOffset: 1 }   // dedup check khi ingest
```

---

## 4. State Machine

```
Consumer publish DLQ envelope
         ↓
    ┌──────────────────────────────────────────┐
    │ errorCategory = logic | schema?          │
    │ → status = requires_manual_review        │
    │   (bỏ qua pending, không auto-retry)     │
    └──────────────────────────────────────────┘
         ↓ otherwise
    ┌─────────────┐
    │   pending   │◄─────────────────────────────────────────┐
    └──────┬──────┘                                          │
           │ scheduler: nextRetryAt <= now                   │
           │ (chỉ khi errorCategory=transient|unknown        │
           │  và retryCount < maxRetries)                    │
           ▼                                                  │
    ┌─────────────┐                                          │
    │  replaying  │ (atomic findOneAndUpdate lock)           │
    └──────┬──────┘                                          │
           │                                                  │
    ┌──────┴──────┐                                          │
    │             │                                          │
    ▼             ▼                                          │
Kafka OK     Kafka FAIL                                      │
    │             │                                          │
    │             ├─ retryCount < maxRetries ────────────────┘
    │             │   (set nextRetryAt = backoff, status=pending)
    │             │
    │             └─ retryCount >= maxRetries
    │                      ↓
    │             ┌──────────────────────┐
    │             │ requires_manual_review│◄──── logic/schema ingest
    │             └──────────┬───────────┘
    │                        │ admin action
    │             ┌──────────┴──────────┐
    │             ▼                     ▼
    │      admin POST /resolve   admin POST /discard
    │             ↓                     ↓
    │      ┌──────────┐         ┌──────────┐
    │      │ resolved │         │ discarded│
    │      └──────────┘         └──────────┘
    │      (terminal)           (terminal)
    │
    └── Kafka produce OK → record không cần status mới
        retryCount++, lastRetriedAt=now, nextRetryAt=null
        Admin xác nhận xong → POST /resolve
```

**Quy tắc chuyển trạng thái:**

| Từ | Sang | Trigger | Điều kiện |
|----|------|---------|-----------|
| *(ingest)* | `pending` | DLQ consumer nhận event | `errorCategory` = transient/unknown |
| *(ingest)* | `requires_manual_review` | DLQ consumer nhận event | `errorCategory` = logic/schema |
| `pending` | `replaying` | Scheduler atomic lock | `nextRetryAt <= now`, `retryCount < maxRetries` |
| `replaying` | `pending` | Kafka produce fail | `retryCount < maxRetries`, set backoff |
| `replaying` | `requires_manual_review` | Kafka produce fail | `retryCount >= maxRetries` |
| `replaying` | `pending` (hoàn thành) | Kafka produce OK | `retryCount++`, `nextRetryAt=null` |
| `pending` / `requires_manual_review` | `replaying` | Admin POST `/replay` | atomic lock |
| `requires_manual_review` | `resolved` | Admin POST `/resolve` | `resolutionNote` optional |
| `pending` / `requires_manual_review` | `discarded` | Admin POST `/discard` | `resolutionNote` optional |

Không có transition admin mặc định sang `requires_manual_review`. Nếu vận hành thực tế cần đưa một record `pending` vào review thủ công, thêm route riêng `POST /api/v1/dlq/messages/:id/escalate` trong PR sau; route này không nằm trong MVP DLQ vì thường ít dùng và dễ làm rối state machine.

---

## 5. ErrorCategory — Classification ở Consumer

Consumer service (task-service, notification-service, ...) chịu trách nhiệm classify lỗi trước khi publish DLQ:

```typescript
function classifyError(err: Error): ErrorCategory {
  // Transient: có thể tự hồi phục
  if (
    err.message.includes('ETIMEDOUT') ||
    err.message.includes('ECONNREFUSED') ||
    err.message.includes('ECONNRESET') ||
    err instanceof MongoNetworkError ||
    (err as any).statusCode === 503 ||
    (err as any).statusCode === 504
  ) {
    return 'transient';
  }

  // Schema: payload không đúng format
  if (err instanceof ValidationError || err.message.includes('is not valid JSON')) {
    return 'schema';
  }

  // Logic: business rule vi phạm, data not found, v.v.
  if (err instanceof NotFoundException || err instanceof BusinessLogicException) {
    return 'logic';
  }

  return 'unknown';
}
```

DLQ envelope published bởi consumer:

```json
{
  "sourceTopic": "collabspace.task.events",
  "sourcePartition": 0,
  "sourceOffset": "1234",
  "sourceKey": "task-uuid",
  "consumerGroup": "notification-service",
  "payload": { "...original Kafka message value..." },
  "errorMessage": "TypeError: Cannot read property 'userId' of undefined",
  "errorCategory": "logic",
  "failedAt": "2026-06-20T08:00:00.000Z"
}
```

---

## 6. Auto-Retry Scheduler

Chạy cron mỗi phút. Chỉ claim records đủ điều kiện:
- `status = pending`
- `nextRetryAt <= now`
- `errorCategory IN (transient, unknown)`
- `retryCount < maxRetries`

Xử lý batch tối đa 50 records/lần để tránh spike CPU.

### Backoff schedule

| Attempt | Delay nextRetryAt | Áp dụng cho |
|---------|-------------------|-------------|
| 1 | +5 phút | transient, unknown |
| 2 | +30 phút | transient |
| 3 | +2 giờ | transient |
| > maxRetries | → `requires_manual_review` | tất cả |

### Atomic lock pattern

```typescript
async claimNextBatch(instanceId: string, batchSize = 50): Promise<DlqRecord[]> {
  const now = new Date();
  const results: DlqRecord[] = [];

  for (let i = 0; i < batchSize; i++) {
    const record = await this.DlqModel.findOneAndUpdate(
      {
        status: 'pending',
        nextRetryAt: { $lte: now },
        errorCategory: { $in: ['transient', 'unknown'] },
      },
      {
        $set: {
          status: 'replaying',
          lockedAt: now,
          lockedBy: instanceId,
        },
      },
      { new: true, sort: { nextRetryAt: 1 } },
    );
    if (!record) break;
    results.push(record);
  }
  return results;
}
```

### Scheduler flow

```typescript
@Cron('* * * * *')
async runAutoRetry() {
  const instanceId = this.configService.get('INSTANCE_ID');
  const batch = await this.repo.claimNextBatch(instanceId);

  for (const record of batch) {
    try {
      await this.replayService.produce(record, 'scheduler');
      await this.repo.markReplayDone(record._id); // retryCount++, nextRetryAt=null, status=pending
    } catch (err) {
      this.logger.error(`Auto-retry failed for ${record._id}: ${err.message}`);
      await this.repo.handleReplayFailure(record); // backoff hoặc requires_manual_review
    }
  }
}
```

### Stale lock cleanup

Pod crash có thể để record kẹt ở `replaying`. Cron mỗi 5 phút:

```typescript
await DlqModel.updateMany(
  { status: 'replaying', lockedAt: { $lt: new Date(Date.now() - 5 * 60_000) } },
  { $set: { status: 'pending', lockedAt: null, lockedBy: null } },
);
```

---

## 7. Replay Logic

Khi replay (auto hoặc manual):

1. `findOneAndUpdate` atomic để lock record (status → `replaying`)
2. Kafka produce về `sourceTopic`:
   - `key`: giữ nguyên `sourceKey` (preserve partition routing)
   - `value`: giữ nguyên `payload` (không modify)
   - Headers:

```
x-dlq-record-id:       <_id>
x-replay-attempt:      <retryCount + 1>
x-original-topic:      <sourceTopic>
x-original-partition:  <sourcePartition>
x-original-offset:     <sourceOffset>
x-replayed-by:         <userId hoặc "scheduler">
x-replayed-at:         <ISO timestamp>
```

3. Update record sau produce:
   - **OK**: `retryCount++`, `lastRetriedAt = now`, `nextRetryAt = null`, `status = pending` (record vẫn tồn tại cho audit, admin có thể `/resolve` sau)
   - **FAIL**: tính backoff hoặc chuyển `requires_manual_review`

---

## 8. HTTP API

Base path: `/api/v1/dlq`

Tất cả routes yêu cầu Bearer JWT. Read routes cần `dlq.read`, write routes cần `dlq.manage`.

### `GET /api/v1/dlq/messages`

List DLQ records với filter và cursor pagination.

**Query params:**
- `status`: filter theo status (multi: `?status=pending&status=requires_manual_review`)
- `errorCategory`: filter (`transient` | `logic` | `schema` | `unknown`)
- `sourceTopic`: filter theo topic
- `from` / `to`: ISO date (createdAt range)
- `limit`: default 20, max 100
- `cursor`: pagination cursor

**Response:**
```json
{
  "data": [
    {
      "id": "...",
      "sourceTopic": "collabspace.task.events",
      "sourcePartition": 0,
      "sourceOffset": "1234",
      "consumerGroup": "notification-service",
      "errorMessage": "TypeError: Cannot read property 'userId' of undefined",
      "errorCategory": "logic",
      "failedAt": "2026-06-20T08:00:00.000Z",
      "status": "requires_manual_review",
      "retryCount": 0,
      "maxRetries": 0,
      "nextRetryAt": null,
      "createdAt": "2026-06-20T07:55:00.000Z"
    }
  ],
  "nextCursor": "...",
  "total": 42
}
```

### `GET /api/v1/dlq/messages/:id`

Chi tiết 1 record kèm `payload`, error detail, và `retryHistory` đầy đủ. Cần `dlq.read`.

FE tự copy payload/error từ response này; không cần API riêng cho thao tác copy.

### `POST /api/v1/dlq/messages/:id/replay`

Admin replay thủ công 1 record. Cần `dlq.manage`.

Cho phép từ status: `pending`, `requires_manual_review`.

**Response:** record sau khi lock (status = `replaying`, sẽ chuyển async).

### `POST /api/v1/dlq/replay-batch`

Replay nhiều records. Cần `dlq.manage`. Max 50 records/batch.

**Request body:**
```json
{
  "ids": ["id1", "id2"],
  "filter": {
    "status": "requires_manual_review",
    "sourceTopic": "collabspace.task.events",
    "errorCategory": "transient"
  }
}
```

Dùng `ids` hoặc `filter`, không dùng cả hai.

### `POST /api/v1/dlq/messages/:id/resolve`

Admin đánh dấu đã xử lý tay xong. Cần `dlq.manage`.

Cho phép từ mọi status trừ `discarded`. `resolutionNote` optional, nếu nhập thì tối đa 1000 ký tự.

**Request body:**
```json
{
  "resolutionNote": "Đã fix bug consumer + deploy. Event này không cần replay vì state đã nhất quán."
}
```

### `POST /api/v1/dlq/messages/:id/discard`

Admin quyết định không xử lý record này. Cần `dlq.manage`. Không xóa, chỉ set `status = discarded`.

Cho phép từ `pending` và `requires_manual_review`.
`resolutionNote` optional, nếu nhập thì tối đa 1000 ký tự.

**Request body:**
```json
{
  "resolutionNote": "Task đã bị xóa, event này không còn hợp lệ."
}
```

### Deferred: `POST /api/v1/dlq/messages/:id/escalate`

Không implement mặc định. Chỉ thêm nếu ops thật sự cần chuyển thủ công một record từ `pending` sang `requires_manual_review`.

---

## 9. Folder Layout

```
services/dlq-service/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   └── dlq.config.ts
│   ├── health/
│   │   └── health.controller.ts
│   ├── metrics/
│   │   └── metrics.controller.ts
│   │
│   ├── dlq/
│   │   ├── dlq.module.ts
│   │   ├── controllers/
│   │   │   └── dlq.controller.ts
│   │   ├── dto/
│   │   │   ├── list-dlq.dto.ts
│   │   │   ├── replay-batch.dto.ts
│   │   │   └── action-dlq.dto.ts       # resolve + discard shared DTO
│   │   ├── services/
│   │   │   ├── dlq.service.ts          # orchestrate state transitions
│   │   │   └── replay.service.ts       # Kafka produce + headers
│   │   └── repositories/
│   │       └── dlq.repository.ts       # Mongo queries + atomic ops
│   │
│   ├── consumers/
│   │   ├── consumers.module.ts
│   │   └── dlq-events.consumer.ts      # consume collabspace.dlq.events
│   │
│   ├── scheduler/
│   │   ├── auto-retry.scheduler.ts     # @Cron mỗi phút
│   │   └── stale-lock.scheduler.ts     # @Cron mỗi 5 phút
│   │
│   └── domain/
│       └── dlq-record.schema.ts        # Mongoose schema, DlqStatus, ErrorCategory enums
│
├── test/
├── CLAUDE.md
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 10. Permission & Auth

Permissions mới seed vào `auth-service`:
- `dlq.read` — xem list và detail
- `dlq.manage` — replay, resolve, discard

Role `platform_admin` nên có cả hai. Không cần tạo role mới.

Header auth pattern: Bearer JWT → gateway forward-auth → inject `X-Permissions`.

---

## 11. Environment Variables

```env
# App
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
INSTANCE_ID=dlq-service-pod-0   # override bởi K8s downward API

# MongoDB
MONGO_URI=mongodb://admin:password@mongo:27017/collabspace_dlq?authSource=admin&replicaSet=rs0

# Kafka
KAFKA_BROKERS=kafka:9092
KAFKA_CLIENT_ID=dlq-service
KAFKA_GROUP_ID=dlq-service
KAFKA_DLQ_TOPIC=collabspace.dlq.events

# Auth
JWT_SECRET=<same as other services>

# Scheduler
DLQ_AUTO_RETRY_ENABLED=true
DLQ_AUTO_RETRY_BATCH_SIZE=50
DLQ_MAX_RETRIES_TRANSIENT=3
DLQ_MAX_RETRIES_UNKNOWN=1

# Metrics
METRICS_AUTH_TOKEN=<secret>
```

### K8s Downward API cho INSTANCE_ID

```yaml
- name: INSTANCE_ID
  valueFrom:
    fieldRef:
      fieldPath: metadata.name
```

---

## 12. Helm / K8s

### values.yaml — thêm vào block `apps:`

```yaml
  dlq-service:
    enabled: true
    replicas: 1
    image:
      repository: collabspace/dlq-service
      tag: latest
    httpPort: 3000
    metricsPath: /api/v1/dlq/metrics
    health:
      readyPath: /api/v1/dlq/health/ready
      livePath: /api/v1/dlq/health/live
      preStopSleep: 5
      terminationGracePeriodSeconds: 30    # scheduler cần hoàn thành batch hiện tại
    resources:
      requests:
        memory: 128Mi
        cpu: 100m
      limits:
        memory: 256Mi
        cpu: 250m
    extraEnv:
      KAFKA_BROKERS: "kafka:9092"
      KAFKA_CLIENT_ID: "dlq-service"
      KAFKA_GROUP_ID: "dlq-service"
      KAFKA_DLQ_TOPIC: "collabspace.dlq.events"
      MONGO_DB_NAME: "collabspace_dlq"
      DLQ_AUTO_RETRY_ENABLED: "true"
      DLQ_AUTO_RETRY_BATCH_SIZE: "50"
      DLQ_MAX_RETRIES_TRANSIENT: "3"
      DLQ_MAX_RETRIES_UNKNOWN: "1"
```

**replicas: 1** đủ cho MVP. Khi scale lên 2+, atomic lock `findOneAndUpdate` đã xử lý race condition.

### Traefik route

```yaml
- match: PathPrefix(`/api/v1/dlq`)
  kind: Rule
  services:
    - name: dlq-service
      port: 3000
  middlewares:
    - name: strip-identity-headers
    - name: forward-auth
```

### Swagger route

```yaml
- match: PathPrefix(`/swagger/dlq`)
  kind: Rule
  services:
    - name: dlq-service
      port: 3000
  middlewares:
    - name: strip-prefix-swagger-dlq
```

---

## 13. Dockerfile

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

## 14. Kafka Topic

```
Topic: collabspace.dlq.events
Partitions: 3
Replication factor: 1  (single-broker; tăng nếu multi-broker)
Retention: 7 ngày
```

Consumer service cần implement retry in-process 3 lần + classify lỗi trước khi publish vào topic này. Xem [.claude/docs/resilience.md](../.claude/docs/resilience.md) cho retry pattern hiện tại.

---

## 15. Observability

### Prometheus metrics

```
dlq_records_total{status,sourceTopic,errorCategory}  # gauge số records
dlq_replay_attempts_total{sourceTopic,trigger,result} # trigger: scheduler|manual; result: success|fail
dlq_oldest_pending_age_seconds                        # gauge record pending cũ nhất
dlq_auto_retry_runs_total                             # counter scheduler chạy
dlq_auto_retry_batch_size                             # histogram batch size
dlq_consumer_events_ingested_total{sourceTopic,errorCategory} # counter events ingest
```

### Alerts

```yaml
- alert: DlqPendingCountHigh
  expr: sum(dlq_records_total{status="pending"}) > 50
  for: 5m
  labels:
    severity: warning

- alert: DlqRequiresManualReview
  expr: sum(dlq_records_total{status="requires_manual_review"}) > 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Có DLQ records cần review thủ công — kiểm tra /api/v1/dlq/messages"

- alert: DlqOldestPendingStale
  expr: dlq_oldest_pending_age_seconds > 14400  # 4 giờ
  for: 10m
  labels:
    severity: warning

- alert: DlqReplayFailureRateHigh
  expr: rate(dlq_replay_attempts_total{result="fail"}[5m]) > 0.5
  for: 5m
  labels:
    severity: warning
```

### Grafana dashboard

Dashboard mới **CollabSpace DLQ** với panels:
- Records by status + errorCategory (stacked bar)
- Replay success vs fail rate (timeseries)
- Oldest pending age (gauge)
- Events ingested per topic/category (timeseries)

---

## 16. FE Admin DLQ UI

UI admin cho DLQ nằm trong repo `collabspace-fe`, thuộc nhóm **Ops/Admin**, tách khỏi analytics dashboard thông thường.

**Spec chi tiết:** [collabspace-fe/docs/admin-dlq-ui.md](../../collabspace-fe/docs/admin-dlq-ui.md)

### Tóm tắt flow

```
FE Admin DLQ Page
  → api-gateway /api/v1/dlq/*
  → dlq-service
  → MongoDB dlq_records + Kafka producer (replay)
```

FE không đọc Kafka trực tiếp. Mọi data và action đều qua `dlq-service` API.

Alertmanager Slack là concern riêng của observability/infra. FE chỉ hiển thị badge/count cho `requires_manual_review` để ops biết cần vào xem; Slack routing vẫn nằm ở Prometheus/Alertmanager config.

### Phân quyền FE

| Quyền | Cho phép |
|-------|---------|
| `dlq.read` | Xem Overview, List, Detail |
| `dlq.manage` | Replay, Discard (buttons chỉ render khi có quyền này) |

Route `/admin/dlq/*` chỉ render khi user có `dlq.read`. Nếu không có quyền → redirect về `/admin`.

Button-level guard: chỉ render Replay/Discard/Resolve khi user có `dlq.manage`. Không render action "Mark manual review" trong UI mặc định.

### Các màn hình

| Màn hình | Route | Quyền |
|----------|-------|-------|
| DLQ Overview | `/admin/dlq` | `dlq.read` |
| DLQ Message List | `/admin/dlq/messages` | `dlq.read` |
| DLQ Message Detail | `/admin/dlq/messages/:id` | `dlq.read` |

Detail page hiển thị payload, error detail, headers/key, source topic/partition/offset, consumer group, retry count, và `retryHistory`. Copy payload/error là thao tác client-side từ data đã load.

### Phase FE

| Phase | Nội dung | Phụ thuộc |
|-------|----------|-----------|
| Phase 1 | Overview cards + Message List + Detail (read-only) | `dlq-service` PR 2 xong |
| Phase 2 | Replay 1 message + Discard | `dlq-service` PR 3 xong |
| Phase 3 | Replay batch + DLQ health chart | `dlq-service` PR 4 xong |
| Phase 4 | Alert badge khi `requires_manual_review > 0` | Alertmanager Slack là infra riêng |

---

## 17. Lộ Trình Implement (4 PR)

### PR 1 — Scaffold

- `services/dlq-service/` NestJS app, `package.json`, `tsconfig.json`, `Dockerfile`
- Health endpoints, config module
- Kết nối Mongo `collabspace_dlq`, tạo `dlq_records` collection + indexes
- `DlqRecord` Mongoose schema + `DlqStatus` + `ErrorCategory` enums + `retryHistory`
- Docker Compose entry (local port `3006`)
- Helm values entry (`enabled: false` ban đầu)

### PR 2 — Ingest + Read API

- `dlq-events.consumer.ts` — consume `collabspace.dlq.events`, classify và persist
  - `logic` / `schema` → ingest thẳng `requires_manual_review`
  - `transient` / `unknown` → ingest `pending`, set `nextRetryAt` theo category
- `GET /dlq/messages` với filter `status`, `errorCategory`, `sourceTopic`, cursor pagination
- `GET /dlq/messages/:id` kèm `payload`
- Swagger decorators, DTO validation
- Guard: `dlq.read` permission
- Unit test consumer ingest logic theo từng errorCategory

### PR 3 — Replay + Discard + Resolve

- `replay.service.ts` — Kafka produce về `sourceTopic` với DLQ headers
- Atomic `findOneAndUpdate` lock trong repository
- `dlq.service.ts` — state transitions với guard validations
- `POST /dlq/messages/:id/replay`
- `POST /dlq/replay-batch`
- `POST /dlq/messages/:id/resolve`
- `POST /dlq/messages/:id/discard`
- Append `retryHistory` cho manual replay/resolve/discard và replay result
- Integration test state machine transitions

### PR 4 — Scheduler + Infra + Observability

- `auto-retry.scheduler.ts` — `@Cron('* * * * *')`, batch claim với errorCategory filter, backoff
- `stale-lock.scheduler.ts` — `@Cron('*/5 * * * *')`, unlock record kẹt > 5 phút
- Append `retryHistory` cho scheduler auto-retry success/failure
- Prometheus metrics
- Grafana dashboard **CollabSpace DLQ** + alert rules
- Helm `enabled: true`, Traefik routes, Swagger route
- K8s Downward API cho `INSTANCE_ID` trong Helm deployment template
- `service-urls.md` và `api-routes.md` update
- Seed `dlq.read` / `dlq.manage` permissions vào `auth-service`

---

## 18. Service URL Summary

| Môi trường | Base URL |
|------------|----------|
| Production | `https://collabspace.ngocanh2005it.site/api/v1/dlq` |
| Local Docker | `http://localhost:3006/api/v1/dlq` |
| Swagger (prod) | `https://collabspace.ngocanh2005it.site/swagger/dlq` |
| Swagger (local) | `http://localhost:3006/swagger` |
| Health ready | `/api/v1/dlq/health/ready` |
| Health live | `/api/v1/dlq/health/live` |
| Metrics | `/api/v1/dlq/metrics` (Bearer `METRICS_AUTH_TOKEN`) |
