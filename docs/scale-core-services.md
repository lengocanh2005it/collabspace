# Scale Core Services lên 2 Replica

> **Mục tiêu:** Scale 5 service chính lên 2 replica để demo High Availability.  
> dlq-service và analytics-service giữ nguyên 1 replica — không nằm trên critical path.

---

## Phân tích tài nguyên trước khi scale

### RAM thực tế (đo ngày 2026-06-25)

| Service | RAM đang dùng | Request cấu hình | Limit |
|---------|--------------|-----------------|-------|
| auth-service | 99Mi | 256Mi | 512Mi |
| user-service | 94Mi | 256Mi | 512Mi |
| workspace-service | 88Mi | 128Mi | 256Mi |
| task-service | 111Mi | 256Mi | 512Mi |
| notification-service | 99Mi | 256Mi | 512Mi |

RAM request thêm khi scale lên 2: **256+256+128+256+256 = 1,152Mi**

### Node capacity

| Node | RAM thực dùng | Allocated requests | Allocatable |
|------|--------------|-------------------|-------------|
| 3cxv85 | 3,994Mi (62%) | 2,973Mi (46%) | ~6,400Mi |
| 3cxv8p | 4,198Mi (65%) | 2,353Mi (36%) | ~6,400Mi |
| 3cxv8s | 3,431Mi (53%) | 1,959Mi (30%) | ~6,400Mi |

**Remaining requests** ≈ 11,900Mi → thêm 1,152Mi vẫn an toàn, RAM node ước tính lên ~60–72%.

---

## Scale lên 2 replica

```bash
kubectl scale deployment auth-service        -n collabspace --replicas=2
kubectl scale deployment user-service        -n collabspace --replicas=2
kubectl scale deployment workspace-service   -n collabspace --replicas=2
kubectl scale deployment task-service        -n collabspace --replicas=2
kubectl scale deployment notification-service -n collabspace --replicas=2
```

Kiểm tra pod đang chạy:

```bash
kubectl get pods -n collabspace -l 'app in (auth-service,user-service,workspace-service,task-service,notification-service)'
```

Kiểm tra tài nguyên sau khi scale:

```bash
kubectl top nodes
kubectl top pods -n collabspace --sort-by=memory
```

---

## Scale về 1 replica (rollback)

```bash
kubectl scale deployment auth-service        -n collabspace --replicas=1
kubectl scale deployment user-service        -n collabspace --replicas=1
kubectl scale deployment workspace-service   -n collabspace --replicas=1
kubectl scale deployment task-service        -n collabspace --replicas=1
kubectl scale deployment notification-service -n collabspace --replicas=1
```

---

## Lưu ý

- Scale bằng `kubectl scale` là **tạm thời** — nếu Helm deploy lại sẽ reset về giá trị trong `values.yaml` (hiện tại `replicaCount: 1`).
- Để scale **vĩnh viễn**, sửa `replicaCount` trong `infrastructure/helm/collabspace/values.yaml` cho từng service rồi `helm upgrade`.
- Kafka consumer (notification, task, analytics) chạy 2 replica sẽ tự cân bằng partition — mỗi consumer group có 2 member, Kafka chia partition cho từng member. Với 1 partition hiện tại, chỉ 1 trong 2 pod xử lý message, pod còn lại standby sẵn sàng takeover.
