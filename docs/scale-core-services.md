# Scale Core Services + Traefik lên 2 Replica

> **Mục tiêu:** Scale 5 service chính + Traefik lên 2 replica để demo High Availability.  
> dlq-service và analytics-service giữ nguyên 1 replica — không nằm trên critical path.  
> Kafka giữ nguyên 1 broker — xem lý do bên dưới.

---

## Phân tích tài nguyên (đo ngày 2026-06-25)

### RAM thực tế mỗi service

| Pod | RAM thực dùng | Request cấu hình | Limit |
|-----|--------------|-----------------|-------|
| auth-service | 99Mi | 256Mi | 512Mi |
| user-service | 94Mi | 256Mi | 512Mi |
| workspace-service | 88Mi | 128Mi | 256Mi |
| task-service | 111Mi | 256Mi | 512Mi |
| notification-service | 99Mi | 256Mi | 512Mi |
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
| 5 service × +1 replica (256+256+128+256+256) | +1,152Mi |
| Traefik +1 replica (không có resource request — best-effort) | +0Mi |
| **Tổng** | **+1,152Mi** |

**Kết luận: Hoàn toàn đủ.** Request toàn cluster tăng từ ~40% lên ~46%. RAM thực tế ước tính lên ~70% — vẫn an toàn.

---

## Tại sao KHÔNG scale Kafka

Kafka đang chạy 1 broker với tất cả topics có `PartitionCount: 1` và `ReplicationFactor: 1`. Scale broker lên 3 mà không tăng replication factor và partition count **không có lợi gì** — broker mới sẽ idle hoàn toàn.

Để scale Kafka đúng cách cần làm đủ 3 bước:
1. Tăng broker lên 3
2. Tăng `replication.factor=3` cho mỗi topic (migrate data)
3. Tăng partition lên ≥3 mỗi topic (rebalance consumer group)

Đây là công việc nặng và không cần thiết — Kafka đang dùng 351m CPU / 611Mi RAM, rất nhẹ. Đưa vào backlog khi traffic thật sự cần.

---

## Tại sao Traefik cũng cần scale

Traefik 1 replica là SPOF ở tầng pod:
- Pod crash → K8s restart, downtime ~30–60s
- Node chứa Traefik chết → reschedule, downtime ~1–3 phút

DigitalOcean Load Balancer phía trước là managed HA — không phải SPOF. Vấn đề chỉ ở Traefik pod.

Scale lên 2 replica cần thêm `podAntiAffinity` để 2 pod không chạy cùng 1 node — nếu không, node đó chết vẫn down hết.

---

## Scale lên 2 replica

```bash
# 5 core services
kubectl scale deployment auth-service         -n collabspace --replicas=2
kubectl scale deployment user-service         -n collabspace --replicas=2
kubectl scale deployment workspace-service    -n collabspace --replicas=2
kubectl scale deployment task-service         -n collabspace --replicas=2
kubectl scale deployment notification-service -n collabspace --replicas=2

# Traefik
kubectl scale deployment traefik -n collabspace --replicas=2
```

Kiểm tra pod đang chạy:

```bash
kubectl get pods -n collabspace -l 'app in (auth-service,user-service,workspace-service,task-service,notification-service,traefik)'
```

Kiểm tra phân bố pod theo node (để xác nhận anti-affinity hoạt động):

```bash
kubectl get pods -n collabspace -o wide | grep -E "auth|user|workspace|task|notification|traefik"
```

Kiểm tra tài nguyên sau khi scale:

```bash
kubectl top nodes
kubectl top pods -n collabspace --sort-by=memory
```

---

## Scale về 1 replica (rollback)

```bash
kubectl scale deployment auth-service         -n collabspace --replicas=1
kubectl scale deployment user-service         -n collabspace --replicas=1
kubectl scale deployment workspace-service    -n collabspace --replicas=1
kubectl scale deployment task-service         -n collabspace --replicas=1
kubectl scale deployment notification-service -n collabspace --replicas=1
kubectl scale deployment traefik              -n collabspace --replicas=1
```

---

## Lưu ý

- Scale bằng `kubectl scale` là **tạm thời** — Helm deploy lại sẽ reset về `replicaCount: 1` trong `values.yaml`.
- Để scale **vĩnh viễn**, sửa `replicaCount` trong `infrastructure/helm/collabspace/values.yaml` cho từng service rồi `helm upgrade`.
- Kafka consumer (notification, task) chạy 2 replica: mỗi consumer group có 2 member, nhưng với 1 partition hiện tại chỉ 1 pod xử lý message — pod còn lại standby sẵn sàng takeover khi pod kia down.
- Traefik hiện không có `resources.requests` config → best-effort class. Nếu muốn vĩnh viễn nên thêm request vào Helm values để K8s schedule ổn định hơn.
