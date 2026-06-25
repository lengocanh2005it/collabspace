# Scale Core Services + Traefik lên 2 Replica

> **Mục tiêu:** Scale 5 service chính + Traefik lên 2 replica để demo High Availability.  
> dlq-service và analytics-service giữ nguyên 1 replica — không nằm trên critical path.  
> Kafka giữ nguyên 1 broker — xem lý do bên dưới.

---

## Phân tích tài nguyên (đo ngày 2026-06-25)

### RAM thực tế mỗi service

| Pod | RAM thực dùng | Request cấu hình | Limit |
|-----|--------------|-----------------|-------|
| auth-service | 99Mi | 128Mi | 256Mi |
| user-service | 94Mi | 128Mi | 256Mi |
| workspace-service | 88Mi | 128Mi | 256Mi |
| task-service | 111Mi | 128Mi | 256Mi |
| notification-service | 99Mi | 128Mi | 256Mi |
| traefik | 80Mi | 0Mi (best-effort) | — |

### Node capacity

| Node | Allocatable | Requests đã dùng | Còn trống |
|------|-------------|-----------------|-----------|
| 3cxv85 | 6,414Mi | 2,973Mi (46%) | **3,441Mi** |
| 3cxv8p | 6,414Mi | 2,353Mi (36%) | **4,061Mi** |
| 3cxv8s | 6,414Mi | 1,959Mi (30%) | **4,455Mi** |
| **Tổng còn trống** | | | **~11,957Mi** |

### RAM cần thêm khi scale

| Việc | RAM request thêm |
|------|-----------------|
| 5 service × +1 replica (128Mi × 5) | +640Mi |
| Traefik: đã là 2 replica trong values.yaml | +0Mi |
| **Tổng** | **+640Mi** |

**Kết luận: Hoàn toàn đủ.** Request cluster tăng từ ~40% lên ~46%. RAM thực tế ước tính ~70% — vẫn an toàn.

---

## Tại sao KHÔNG scale Kafka

Kafka đang chạy 1 broker với tất cả topics có `PartitionCount: 1` và `ReplicationFactor: 1`. Scale broker lên 3 mà không tăng replication factor và partition count **không có lợi gì** — broker mới sẽ idle hoàn toàn.

Để scale Kafka đúng cách cần làm đủ 3 bước:
1. Tăng broker lên 3
2. Tăng `replication.factor=3` cho mỗi topic
3. Tăng partition lên ≥3 mỗi topic (rebalance consumer group)

Kafka đang dùng 351m CPU / 611Mi RAM — rất nhẹ. Đưa vào backlog khi traffic thật sự cần.

---

## Tại sao Traefik cũng cần scale

Traefik 1 replica là SPOF ở tầng pod:
- Pod crash → K8s restart, downtime ~30–60s
- Node chứa Traefik chết → reschedule, downtime ~1–3 phút

DigitalOcean Load Balancer phía trước là managed HA — không phải SPOF. Vấn đề chỉ ở Traefik pod.

> Traefik đã được set `deployment.replicas: 2` trong `values.yaml` — không cần thay đổi thêm cho Traefik.

---

## Cách scale vĩnh viễn qua Helm

### Bước 1 — Sửa `infrastructure/helm/collabspace/values.yaml`

Tìm block `apps:` và đổi `replicas: 1` → `replicas: 2` cho 5 service:

```yaml
apps:
  auth-service:
    replicas: 2          # was: 1

  user-service:
    replicas: 2          # was: 1

  workspace-service:
    replicas: 2          # was: 1

  task-service:
    replicas: 2          # was: 1

  notification-service:
    replicas: 2          # was: 1
```

### Bước 2 — Helm upgrade

```bash
helm upgrade collabspace infrastructure/helm/collabspace \
  -n collabspace \
  -f infrastructure/helm/collabspace/values.yaml \
  -f infrastructure/helm/collabspace/values-prod.yaml \
  --atomic \
  --timeout 5m
```

`--atomic`: nếu bất kỳ pod nào không ready trong 5 phút, tự động rollback về revision trước.

### Bước 3 — Kiểm tra

```bash
# Xem pod đã chạy đủ 2 replica chưa
kubectl get pods -n collabspace

# Xem pod phân bổ trên node nào
kubectl get pods -n collabspace -o wide

# Xem tài nguyên sau scale
kubectl top nodes
kubectl top pods -n collabspace --sort-by=memory
```

---

## Rollback

```bash
# Xem lịch sử revision
helm history collabspace -n collabspace

# Rollback về revision trước
helm rollback collabspace -n collabspace
```

Hoặc sửa lại `replicas: 1` trong `values.yaml` rồi chạy lại `helm upgrade`.

---

## Lưu ý

- Kafka consumer (notification, task) chạy 2 replica: mỗi consumer group có 2 member nhưng với 1 partition hiện tại chỉ 1 pod xử lý message — pod còn lại standby, sẵn sàng takeover khi pod kia down.
- Traefik không có `resources.requests` trong values.yaml hiện tại → best-effort scheduling class. Nếu muốn K8s schedule ổn định hơn, thêm vào `traefik.resources.requests` trong values.yaml.
- `maxUnavailable: 0` đã được set trong deployment template — rolling update sẽ không có downtime (surge 1 pod mới trước, xóa pod cũ sau).
