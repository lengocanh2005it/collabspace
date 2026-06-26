# Scale 5 Core Services lên 2 Replica

> **Mục tiêu trước mắt:** Scale 5 service chính lên 2 replica để demo High Availability ở tầng application.  
> dlq-service và analytics-service giữ nguyên 1 replica — không nằm trên critical path.  
> Traefik, Kafka và Debezium vẫn là các điểm SPOF cần xử lý ở phase HA riêng — xem ghi chú bên dưới.

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
| **Tổng** | **+640Mi** |

**Kết luận: Hoàn toàn đủ để scale 5 core services trước.** Request cluster tăng khoảng +640Mi RAM và +350m CPU. Với số đo live ngày 2026-06-25, DOKS vẫn còn nhiều headroom, không có pod `Pending` hoặc `CrashLoopBackOff`.

---

## Thứ tự triển khai khuyến nghị

1. Scale 5 core services lên 2 replica trước:
   - `auth-service`
   - `user-service`
   - `workspace-service`
   - `task-service`
   - `notification-service`
2. Sau khi rollout ổn định, kiểm tra lại:
   - `kubectl get pods -n collabspace`
   - `kubectl top nodes`
   - `kubectl top pods -n collabspace --sort-by=memory`
3. Xử lý Traefik, Kafka, Debezium ở các phase HA riêng. Không gộp chung với lần scale app service đầu tiên.

Lý do: 5 service chính là stateless app pods nên scale an toàn hơn. Traefik/Kafka/Debezium có ràng buộc state, storage, replication, offset hoặc TLS nên cần thiết kế riêng để tránh tạo HA "nửa vời".

---

## Các SPOF còn lại sau khi scale app services

### Traefik

Traefik 1 replica là SPOF ở tầng ingress pod:
- Pod crash → K8s restart, downtime khoảng 30-60s
- Node chứa Traefik chết → reschedule, downtime khoảng 1-3 phút

DigitalOcean Load Balancer phía trước là managed HA — không phải SPOF. Vấn đề hiện tại là backend Traefik pod.

**Không nên chỉ đổi Traefik `replicas: 2` ngay lập tức.** Live DOKS ngày 2026-06-25 đang chạy Traefik `1/1`, mount PVC `traefik` dạng RWO vào `/data/acme.json`, strategy `Recreate`, QoS `BestEffort`. Nếu scale thẳng lên 2 replica, cần kiểm tra kỹ ACME/TLS storage và khả năng mount PVC.

Hướng an toàn hơn:
- Chuyển TLS/ACME sang `cert-manager`, DigitalOcean managed certificate, hoặc Kubernetes Secret được quản lý ngoài Traefik.
- Thêm `traefik.resources.requests` để scheduler ổn định hơn.
- Sau khi không còn phụ thuộc một PVC RWO chung cho ACME, scale Traefik lên 2 replica và verify qua DO Load Balancer.

### Kafka

Kafka đang chạy 1 broker với topics hiện tại chủ yếu `PartitionCount: 1` và `ReplicationFactor: 1`. Scale broker lên 3 mà không đổi replication/partition **không có lợi nhiều** — broker mới có thể idle, còn dữ liệu topic vẫn không HA.

Để scale Kafka đúng cách cần làm đủ:
1. Tăng broker lên 3.
2. Tăng `replication.factor=3` cho topic mới.
3. Reassign topic cũ sang replication factor 3.
4. Tăng partition lên >=3 cho topic cần song song hóa consumer.
5. Set `min.insync.replicas=2` và producer `acks=all` cho luồng event quan trọng.
6. Verify consumer group rebalance, lag, DLQ và recovery khi kill broker.

### Debezium Connect

Debezium Connect 1 replica là SPOF ở tầng CDC/outbox publisher. Nếu pod chết, event có thể bị delay nhưng thường sẽ catch up khi pod sống lại nếu Kafka/offset/outbox còn nguyên.

Không nên scale Debezium trước Kafka HA. Hướng đúng:
- Làm Kafka HA trước để offset/config/status topics có replication.
- Sau đó scale Debezium Connect workers.
- Kiểm tra connector config, task count, offset storage và khả năng catch up sau restart/failover.

## Cách scale 5 core services vĩnh viễn qua Helm

### Bước 1 — Sửa Helm values

Tìm block `apps:` và đổi `replicas: 1` → `replicas: 2` cho 5 service trong:

- `infrastructure/helm/collabspace/values.yaml`
- `infrastructure/helm/collabspace/values-prod.example.yaml`

Production thật dùng GitHub secret `HELM_VALUES_PROD`, nên secret này cũng phải không override 5 service về `replicas: 1`.

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
